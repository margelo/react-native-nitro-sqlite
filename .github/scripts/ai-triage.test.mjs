import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {main, proposedLabels, requestBody, validateResult} from './ai-triage.mjs';

test('only approved labels are accepted from the model', () => {
  const result = validateResult({
    type: 'bug',
    areas: ['area:runtime'],
    platforms: ['platform:ios'],
    missing: ['steps', 'versions'],
  });
  assert.deepEqual(
    proposedLabels(result, new Set(['bug', 'platform:ios'])),
    ['area:runtime'],
  );
  assert.throws(() =>
    validateResult({
      type: 'invalid',
      areas: [],
      platforms: [],
      missing: [],
    }),
  );
  assert.throws(() =>
    validateResult({
      type: 'question',
      areas: [],
      platforms: [],
      missing: ['steps'],
    }),
  );
  assert.throws(() =>
    validateResult({
      type: 'bug',
      areas: [],
      platforms: [],
      missing: ['steps'],
    }, true),
  );
  assert.equal(
    validateResult({type: 'question', areas: [], platforms: [], missing: []}, true).type,
    '',
  );
});

test('missing detail requests have fixed text and AI attribution', () => {
  const body = requestBody(['steps', 'versions'], "Chris's AI sidekick here. 🤖");
  assert.ok(body.startsWith("Chris's AI sidekick here. 🤖\n\n"));
  assert.match(body, /Steps or a small code sample/);
  assert.match(body, /React Native version/);
  assert.match(body, /<!-- nitro-sqlite-ai-triage -->/);
  assert.doesNotMatch(body, /logs/i);
});

test('an author update clears the bot label and edits its request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ai-triage-'));
  const eventPath = join(directory, 'event.json');
  const previousFetch = global.fetch;
  const previousEnv = {
    GITHUB_EVENT_PATH: process.env.GITHUB_EVENT_PATH,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
    GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME,
    GH_TOKEN: process.env.GH_TOKEN,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
  const labels = [];
  const comments = [];
  const classifications = [
    {type: 'bug', areas: ['area:runtime'], platforms: [], missing: ['steps']},
    {type: 'bug', areas: ['area:runtime'], platforms: [], missing: []},
  ];
  let createdComments = 0;

  try {
    Object.assign(process.env, {
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: 'margelo/react-native-nitro-sqlite',
      GITHUB_EVENT_NAME: 'issues',
      GH_TOKEN: 'test-token',
      OPENAI_API_KEY: 'test-key',
    });
    global.fetch = async (url, options = {}) => {
      const path = new URL(url).pathname;
      const method = options.method ?? 'GET';
      const response = (body, status = 200) => new Response(
        status === 204 ? null : JSON.stringify(body),
        {status, headers: {'Content-Type': 'application/json'}},
      );

      if (path === '/v1/responses') {
        return response({output: [{content: [{
          type: 'output_text',
          text: JSON.stringify(classifications.shift()),
        }]}]});
      }
      if (path.endsWith('/issues/1') && method === 'GET') {
        return response({
          title: 'Query fails',
          body: 'A query fails',
          state: 'open',
          user: {login: 'reporter'},
          labels: labels.map((name) => ({name})),
        });
      }
      if (path.endsWith('/issues/1/comments') && method === 'GET') {
        return response(comments);
      }
      if (path.endsWith('/issues/1/labels') && method === 'POST') {
        labels.push(...JSON.parse(options.body).labels);
        return response(labels.map((name) => ({name})));
      }
      if (path.includes('/issues/1/labels/') && method === 'DELETE') {
        const label = decodeURIComponent(path.split('/').at(-1));
        labels.splice(labels.indexOf(label), 1);
        return response(null, 204);
      }
      if (path.endsWith('/issues/1/comments') && method === 'POST') {
        createdComments++;
        comments.push({
          id: 1,
          user: {login: 'github-actions[bot]'},
          body: JSON.parse(options.body).body,
        });
        return response(comments[0], 201);
      }
      if (path.endsWith('/issues/comments/1') && method === 'PATCH') {
        comments[0].body = JSON.parse(options.body).body;
        return response(comments[0]);
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    };

    await writeFile(eventPath, JSON.stringify({action: 'opened', issue: {number: 1}}));
    await main();
    assert.deepEqual(labels, ['bug', 'area:runtime', 'triage:needs-reproduction']);
    assert.equal(createdComments, 1);
    assert.match(comments[0].body, /<!-- status:triage:needs-reproduction -->/);
    const opening = comments[0].body.split('\n', 1)[0];
    assert.match(opening, /^Chris's .*AI .* 🤖$/);

    await writeFile(eventPath, JSON.stringify({action: 'edited', issue: {number: 1}}));
    await main();
    assert.deepEqual(labels, ['bug', 'area:runtime']);
    assert.equal(createdComments, 1);
    assert.match(comments[0].body, /appears to include the details requested/);
    assert.ok(comments[0].body.startsWith(`${opening}\n\n`));
  } finally {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, {recursive: true, force: true});
  }
});
