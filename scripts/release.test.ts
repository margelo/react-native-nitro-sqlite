import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { mock } from 'node:test'
import {
  GitHub,
  type ChangelogSection,
  type ReleaserConfig,
} from 'release-please'
import { Version } from 'release-please/build/src/version.js'
import { Node } from 'release-please/build/src/strategies/node.js'
import { TagName } from 'release-please/build/src/util/tag-name.js'
import { parseConventionalCommits } from 'release-please/build/src/commit.js'
import {
  releasePlan,
  validateReleaseVersions,
  parseVersion,
  releaseChecksReady,
} from './release-plan.ts'
import {
  distributionTag,
  pendingPackages,
  checkTrustedPublishers,
  verifyPublication,
} from './release-registry.ts'

test('patch/minor/major resolve from the selected maintenance branch', () => {
  fixture(() => {
    git('branch', 'maintenance')
    git('commit', '--allow-empty', '-m', 'feat: main-only change')
    git('tag', 'v1.2.0')
    git('switch', 'maintenance')
    git('commit', '--allow-empty', '-m', 'fix: maintenance fix')
    assert.equal(releasePlan('patch').version, '1.0.1')
    assert.equal(releasePlan('minor').version, '1.1.0')
    assert.equal(releasePlan('major').version, '2.0.0')
    assert.equal(releasePlan('1.5.0').previousTag, 'v1.0.0')
  })
})

test('sibling maintenance patches do not cause duplicate versions on main', () => {
  fixture(() => {
    git('switch', '-c', 'release/1.0')
    git('commit', '--allow-empty', '-m', 'fix: sibling maintenance fix')
    git('tag', 'v1.0.1')
    git('switch', 'main')
    git('commit', '--allow-empty', '-m', 'fix: main fix')
    assert.equal(releasePlan('patch').version, '1.0.2')
    assert.equal(releasePlan('patch').previousTag, 'v1.0.0')
    assert.throws(() => releasePlan('1.0.1'), /increase|already exists/)
  })
})

test('rejects reused tags, non-increasing versions and malformed input', () => {
  fixture(() => {
    assert.throws(() => releasePlan('1.0.0'), /increase/)
    assert.throws(() => releasePlan('preminor'), /exact stable/)
    assert.throws(() => releasePlan('01.0.1'), /exact stable/)
    git('commit', '--allow-empty', '-m', 'feat: new major')
    git('tag', 'v2.0.0')
    assert.throws(() => releasePlan('major'), /already exists/)
  })
})

test('validates internal dependency versions before publication', () => {
  fixture((directory) => {
    validateReleaseVersions('1.0.0')
    const path = join(directory, 'example/package.json')
    const metadata = JSON.parse(readFileSync(path, 'utf8'))
    metadata.dependencies['react-native-nitro-sqlite-vec'] = '0.9.0'
    writeFileSync(path, JSON.stringify(metadata))
    assert.throws(
      () => validateReleaseVersions('1.0.0'),
      /dependencies.react-native-nitro-sqlite-vec/,
    )
  })
})

test('stable version parsing rejects prereleases and unsafe components', () => {
  assert.deepEqual(parseVersion('10.1.0'), [10, 1, 0])
  for (const invalid of [
    'patch',
    'v10.0.0',
    '10.0.0-beta.1',
    '10.0.0+build',
    '999999999999999999.0.0',
  ]) {
    assert.throws(() => parseVersion(invalid))
  }
})

test('a release waits for optional native checks and fails on unsuccessful CI', () => {
  const success = { status: 'COMPLETED', conclusion: 'SUCCESS' }
  assert.equal(
    releaseChecksReady([success, { status: 'IN_PROGRESS', conclusion: '' }]),
    false,
  )
  assert.equal(releaseChecksReady([success, { state: 'PENDING' }]), false)
  assert.equal(releaseChecksReady([]), false)
  assert.equal(
    releaseChecksReady([
      success,
      { status: 'COMPLETED', conclusion: 'SKIPPED' },
      { state: 'SUCCESS' },
    ]),
    true,
  )
  assert.throws(
    () => releaseChecksReady([{ status: 'COMPLETED', conclusion: 'FAILURE' }]),
    /failed/,
  )
  assert.throws(() => releaseChecksReady([{ state: 'ERROR' }]), /failed/)
})

test('maintenance releases cannot move the latest npm channel backwards', async () => {
  const stub = mock.method(globalThis, 'fetch', async () =>
    Response.json({ version: '10.1.0' }),
  )
  try {
    assert.equal(await distributionTag('9.8.4'), 'legacy-9')
    assert.equal(await distributionTag('10.0.2'), 'maintenance-10.0')
    assert.equal(await distributionTag('10.1.1'), 'latest')
    assert.equal(await distributionTag('11.0.0'), 'latest')
  } finally {
    stub.mock.restore()
  }
})

test('partial publication retries skip only packages from the same release commit', async () => {
  const stub = mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request) =>
      String(input).includes('react-native-nitro-sqlite-vec/')
        ? new Response('', { status: 404 })
        : Response.json({ gitHead: 'release-commit' }),
  )
  try {
    assert.deepEqual(await pendingPackages('10.1.0', 'release-commit'), [
      'react-native-nitro-sqlite-vec',
    ])
    await verifyPublication(
      'react-native-nitro-sqlite',
      '10.1.0',
      'release-commit',
    )
    await assert.rejects(
      pendingPackages('10.1.0', 'another-commit'),
      /different commit/,
    )
  } finally {
    stub.mock.restore()
  }
})

test('registry errors fail preflight rather than treating a version as unpublished', async () => {
  const stub = mock.method(
    globalThis,
    'fetch',
    async () => new Response('', { status: 503 }),
  )
  try {
    await assert.rejects(pendingPackages('10.1.0', 'release-commit'), /503/)
  } finally {
    stub.mock.restore()
  }
})

test('both trusted publishers must pass before publication can start', async () => {
  const oldUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  const oldToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  process.env.ACTIONS_ID_TOKEN_REQUEST_URL =
    'https://oidc.example.invalid/token'
  process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = 'fixture'
  const requests: string[] = []
  const stub = mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request) => {
      const url = String(input)
      requests.push(url)
      if (url.startsWith('https://oidc.example.invalid/'))
        return Response.json({ value: 'fixture-identity' })
      if (url.endsWith('react-native-nitro-sqlite-vec'))
        return new Response('', { status: 403 })
      return Response.json({ token: 'fixture-exchange' })
    },
  )
  try {
    await assert.rejects(
      checkTrustedPublishers([
        'react-native-nitro-sqlite',
        'react-native-nitro-sqlite-vec',
      ]),
      /vec: npm OIDC exchange failed/,
    )
    assert.equal(requests.length, 4)
    assert.ok(requests[0]?.includes('audience=npm%3Aregistry.npmjs.org'))
  } finally {
    stub.mock.restore()
    if (oldUrl === undefined) delete process.env.ACTIONS_ID_TOKEN_REQUEST_URL
    else process.env.ACTIONS_ID_TOKEN_REQUEST_URL = oldUrl
    if (oldToken === undefined)
      delete process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
    else process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN = oldToken
  }
})

test('Release Please updates every public version and keeps the configured changelog groups', async () => {
  const config: {
    packages: Record<
      string,
      {
        'changelog-sections': ChangelogSection[]
        'extra-files': NonNullable<ReleaserConfig['extraFiles']>
      }
    >
  } = JSON.parse(
    readFileSync(
      new URL('../release-please-config.json', import.meta.url),
      'utf8',
    ),
  )
  const options = config.packages['.']
  assert.ok(options)
  const client = await GitHub.create({
    owner: 'margelo',
    repo: 'react-native-nitro-sqlite',
    token: 'fixture',
    defaultBranch: 'maintenance',
  })
  const manifest = readFileSync(
    new URL('../package.json', import.meta.url),
    'utf8',
  )
  const stub = mock.method(
    client,
    'getFileContentsOnBranch',
    async (path: string, branch: string) => {
      assert.equal(path, 'package.json')
      assert.equal(branch, 'maintenance')
      return {
        content: Buffer.from(manifest).toString('base64'),
        parsedContent: manifest,
        sha: 'fixture',
      }
    },
  )
  try {
    const strategy = new Node({
      github: client,
      targetBranch: 'maintenance',
      releaseAs: '2.0.0',
      includeComponentInTag: false,
      changelogSections: options['changelog-sections'],
      extraFiles: options['extra-files'],
    })
    const messages = [
      'feat!: add new connection mode',
      'perf: improve query scheduling',
      'fix: fix connection ownership',
      'refactor: simplify queue',
      'chore: update build flow',
      'chore(deps): bump SQLite',
      'docs: explain WAL',
    ]
    const pr = await strategy.buildReleasePullRequest(
      parseConventionalCommits(
        messages.map((message, index) => ({
          message,
          sha: String(index + 1).repeat(40),
        })),
      ),
      { tag: new TagName(Version.parse('1.0.0')), sha: 'baseline', notes: '' },
    )
    assert.ok(pr)
    const changelog = pr.updates
      .find((update) => update.path === 'CHANGELOG.md')
      ?.updater.updateContent(undefined)
    assert.ok(changelog)
    for (const section of [
      'Features',
      'Performance Improvements',
      'Bug Fixes',
      'Code Refactoring',
      'Project configuration and build flow',
      'Dependency Upgrades',
      'Documentation',
      'BREAKING CHANGES',
    ]) {
      assert.ok(changelog.includes(section), section)
    }
    const contents = new Map<string, string>()
    for (const update of pr.updates) {
      if (
        !update.path.endsWith('package.json') ||
        update.path.startsWith('samples/')
      )
        continue
      const original =
        contents.get(update.path) ??
        readFileSync(new URL('../' + update.path, import.meta.url), 'utf8')
      contents.set(update.path, update.updater.updateContent(original))
    }
    fixture((directory) => {
      for (const [path, content] of contents)
        writeFileSync(join(directory, path), content)
      validateReleaseVersions('2.0.0')
    })
  } finally {
    stub.mock.restore()
  }
})

function fixture(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'nitro-release-plan-'))
  const original = process.cwd()
  try {
    process.chdir(directory)
    git('init', '-b', 'main')
    git('config', 'user.name', 'Christoph Pader')
    git('config', 'user.email', 'release-test@example.invalid')
    // These disposable fixture commits are never pushed and do not need a CI signing key.
    git('config', 'commit.gpgsign', 'false')
    for (const path of [
      'package.json',
      'packages/react-native-nitro-sqlite/package.json',
      'packages/react-native-nitro-sqlite-vec/package.json',
      'example/package.json',
    ]) {
      mkdirSync(join(directory, path, '..'), { recursive: true })
      writeFileSync(
        path,
        JSON.stringify({
          version: '1.0.0',
          dependencies: {
            'react-native-nitro-sqlite': '1.0.0',
            'react-native-nitro-sqlite-vec': '1.0.0',
          },
          devDependencies: { 'react-native-nitro-sqlite': '1.0.0' },
        }),
      )
    }
    git('add', '.')
    git('commit', '-m', 'chore: initial release')
    git('tag', 'v1.0.0')
    run(directory)
  } finally {
    process.chdir(original)
    rmSync(directory, { recursive: true, force: true })
  }
}

function git(...args: string[]): void {
  execFileSync('git', args, { stdio: 'pipe' })
}
