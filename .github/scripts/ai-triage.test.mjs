import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  main,
  proposedLabels,
  requestBody,
  validateResult,
} from './ai-triage.mjs'

test('only approved labels are accepted from the model', () => {
  const result = validateResult({
    type: 'bug',
    areas: ['area:runtime'],
    platforms: ['platform:ios'],
    missing: ['steps', 'versions'],
  })
  assert.deepEqual(proposedLabels(result, new Set(['bug', 'platform:ios'])), [
    'area:runtime',
  ])
  assert.throws(() =>
    validateResult({
      type: 'invalid',
      areas: [],
      platforms: [],
      missing: [],
    }),
  )
  assert.throws(() =>
    validateResult({
      type: 'question',
      areas: [],
      platforms: [],
      missing: ['steps'],
    }),
  )
  assert.throws(() =>
    validateResult(
      {
        type: 'bug',
        areas: [],
        platforms: [],
        missing: ['steps'],
      },
      true,
    ),
  )
  assert.equal(
    validateResult(
      { type: 'question', areas: [], platforms: [], missing: [] },
      true,
    ).type,
    '',
  )
})

test('missing detail requests have fixed text and AI attribution', () => {
  const body = requestBody(
    ['steps', 'versions'],
    "Chris's AI sidekick here. 🤖",
  )
  assert.ok(body.startsWith("Chris's AI sidekick here. 🤖\n\n"))
  assert.match(body, /Steps or a small code sample/)
  assert.match(body, /React Native version/)
  assert.match(body, /<!-- nitro-sqlite-ai-triage -->/)
  assert.doesNotMatch(body, /logs/i)
})

test('an author update clears the bot label and edits its request', async () => {
  await withTriageFixture(async (fixture) => {
    await main()
    assert.deepEqual(fixture.labels, [
      'bug',
      'area:runtime',
      'triage:needs-reproduction',
    ])
    assert.equal(fixture.comments.length, 1)
    assert.match(
      fixture.comments[0].body,
      /<!-- status:triage:needs-reproduction -->/,
    )
    const opening = fixture.comments[0].body.split('\n', 1)[0]
    assert.match(opening, /^Chris's .*AI .* 🤖$/)

    await fixture.event('edited')
    await main()
    assert.deepEqual(fixture.labels, ['bug', 'area:runtime'])
    assert.equal(fixture.comments.length, 1)
    assert.match(
      fixture.comments[0].body,
      /appears to include the details requested/,
    )
    assert.ok(fixture.comments[0].body.startsWith(`${opening}\n\n`))
  })
})

test('an author reply during classification is handled without a stale request', async () => {
  await withTriageFixture(async (fixture) => {
    fixture.onClassify = () => {
      fixture.comments.push({
        user: { login: 'reporter' },
        body: 'Here are the reproduction steps.',
      })
      fixture.onClassify = undefined
    }
    await main()
    assert.deepEqual(fixture.labels, [])
    assert.equal(fixture.comments.length, 1)

    process.env.GITHUB_EVENT_NAME = 'issue_comment'
    await fixture.event('created')
    await main()
    assert.deepEqual(fixture.labels, ['bug', 'area:runtime'])
    assert.equal(fixture.comments.length, 1)
    assert.equal(fixture.modelInputs.length, 2)
    assert.deepEqual(fixture.modelInputs[1].authorComments, [
      'Here are the reproduction steps.',
    ])
  })
})

test('repeated opening events reuse the existing request', async () => {
  await withTriageFixture(async (fixture) => {
    fixture.classifications[1].missing = ['steps']
    await main()
    const body = fixture.comments[0].body
    await main()
    assert.equal(fixture.comments.length, 1)
    assert.equal(fixture.comments[0].body, body)
  })
})

test('an edited author reply is included in the next classification', async () => {
  await withTriageFixture(async (fixture) => {
    fixture.comments.push({
      id: 2,
      user: { login: 'reporter' },
      body: 'Initial reply',
    })
    fixture.onClassify = () => {
      fixture.comments[0].body = 'Updated reproduction steps'
      fixture.onClassify = undefined
    }
    await main()
    assert.deepEqual(fixture.labels, [])
    process.env.GITHUB_EVENT_NAME = 'issue_comment'
    await fixture.event('edited')
    await main()
    assert.deepEqual(fixture.modelInputs[1].authorComments, [
      'Updated reproduction steps',
    ])
    assert.deepEqual(fixture.labels, ['bug', 'area:runtime'])
    assert.equal(fixture.comments.length, 1)
  })
})

test('model disagreement keeps a labeled bug request incomplete', async () => {
  await withTriageFixture(async (fixture) => {
    await main()
    const body = fixture.comments[0].body
    fixture.classifications[0].type = 'enhancement'
    await fixture.event('edited')
    await main()
    assert.equal(fixture.modelInputs[1].existingType, 'bug')
    assert.ok(fixture.labels.includes('triage:needs-reproduction'))
    assert.equal(fixture.comments[0].body, body)
  })
})

test('human classification added during the model call is preserved', async () => {
  await withTriageFixture(async (fixture) => {
    fixture.onClassify = () => fixture.labels.push('enhancement')
    await main()
    assert.deepEqual(fixture.labels, ['enhancement', 'area:runtime'])
    assert.equal(fixture.comments.length, 0)
  })
})

test('human triage status labels are never removed by an author update', async () => {
  await withTriageFixture(async (fixture) => {
    fixture.labels.push('bug', 'triage:needs-info')
    await main()
    await fixture.event('edited')
    await main()
    assert.ok(fixture.labels.includes('triage:needs-info'))
    assert.equal(fixture.comments.length, 1)
  })
})

test('an issue closed during classification receives no mutations', async () => {
  await withTriageFixture(async (fixture) => {
    fixture.onClassify = () => {
      fixture.item.state = 'closed'
    }
    await main()
    assert.deepEqual(fixture.labels, [])
    assert.equal(fixture.comments.length, 0)
  })
})

test('pull requests only receive allowed labels and no detail requests', async () => {
  await withTriageFixture(async (fixture) => {
    process.env.GITHUB_EVENT_NAME = 'pull_request_target'
    fixture.classifications[0] = {
      type: 'enhancement',
      areas: ['area:api'],
      platforms: ['platform:visionos'],
      missing: [],
    }
    await main()
    assert.deepEqual(fixture.labels, [
      'enhancement',
      'area:api',
      'platform:visionos',
    ])
    assert.deepEqual(fixture.comments, [])
    assert.deepEqual(fixture.modelInputs[0].files, [
      'packages/react-native-nitro-sqlite/src/types.ts',
    ])
  })
})

test('Dependabot pull requests do not call the model', async () => {
  await withTriageFixture(async (fixture) => {
    process.env.GITHUB_EVENT_NAME = 'pull_request_target'
    fixture.item.user.login = 'dependabot[bot]'
    await main()
    assert.deepEqual(fixture.labels, [])
    assert.equal(fixture.modelInputs.length, 0)
  })
})

async function withTriageFixture(run) {
  const directory = await mkdtemp(join(tmpdir(), 'ai-triage-'))
  const eventPath = join(directory, 'event.json')
  const previousFetch = global.fetch
  const previousEnv = {
    GITHUB_EVENT_PATH: process.env.GITHUB_EVENT_PATH,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME,
    GH_TOKEN: process.env.GH_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  }
  const fixture = {
    labels: [],
    comments: [],
    item: {
      title: 'Query fails',
      body: 'A query fails',
      state: 'open',
      user: { login: 'reporter' },
    },
    classifications: [
      {
        type: 'bug',
        areas: ['area:runtime'],
        platforms: [],
        missing: ['steps'],
      },
      { type: 'bug', areas: ['area:runtime'], platforms: [], missing: [] },
    ],
    modelInputs: [],
    onClassify: undefined,
    event: (action) =>
      writeFile(
        eventPath,
        JSON.stringify({
          action,
          issue: { number: 1 },
          pull_request: { number: 1 },
        }),
      ),
  }
  const { labels, comments, classifications, item } = fixture

  try {
    Object.assign(process.env, {
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'margelo/react-native-nitro-sqlite',
      GITHUB_EVENT_NAME: 'issues',
      GH_TOKEN: 'test-token',
      OPENAI_API_KEY: 'test-key',
    })
    global.fetch = async (url, options = {}) => {
      const path = new URL(url).pathname
      const method = options.method ?? 'GET'
      const response = (body, status = 200) =>
        new Response(status === 204 ? null : JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })

      if (path === '/v1/responses') {
        fixture.modelInputs.push(JSON.parse(JSON.parse(options.body).input))
        await fixture.onClassify?.()
        return response({
          output: [
            {
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify(classifications.shift()),
                },
              ],
            },
          ],
        })
      }
      if (
        (path.endsWith('/issues/1') || path.endsWith('/pulls/1')) &&
        method === 'GET'
      ) {
        return response({
          ...item,
          labels: labels.map((name) => ({ name })),
        })
      }
      if (path.endsWith('/pulls/1/files') && method === 'GET') {
        return response([
          { filename: 'packages/react-native-nitro-sqlite/src/types.ts' },
        ])
      }
      if (path.endsWith('/issues/1/comments') && method === 'GET') {
        return response(comments)
      }
      if (path.endsWith('/issues/1/labels') && method === 'POST') {
        labels.push(...JSON.parse(options.body).labels)
        return response(labels.map((name) => ({ name })))
      }
      if (path.includes('/issues/1/labels/') && method === 'DELETE') {
        const label = decodeURIComponent(path.split('/').at(-1))
        labels.splice(labels.indexOf(label), 1)
        return response(null, 204)
      }
      if (path.endsWith('/issues/1/comments') && method === 'POST') {
        comments.push({
          id: 1,
          user: { login: 'github-actions[bot]' },
          body: JSON.parse(options.body).body,
        })
        return response(comments.at(-1), 201)
      }
      if (path.endsWith('/issues/comments/1') && method === 'PATCH') {
        comments[0].body = JSON.parse(options.body).body
        return response(comments[0])
      }
      throw new Error(`Unexpected request: ${method} ${path}`)
    }

    await fixture.event('opened')
    await run(fixture)
  } finally {
    global.fetch = previousFetch
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(directory, { recursive: true, force: true })
  }
}
