import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./publish-release.ts', import.meta.url))

test('publishing validates both packages and publishers before publishing in dependency order', () => {
  const result = runPublication()
  assert.equal(result.status, 0, result.stderr)
  const publish = result.calls.findIndex((line) => line.startsWith('npm:'))
  assert.ok(publish > 0)
  assert.ok(
    result.calls
      .slice(0, publish)
      .includes('bun:react-native-nitro-sqlite-vec:run lint'),
  )
  assert.ok(
    result.calls
      .slice(0, publish)
      .includes('bun:react-native-nitro-sqlite:run build'),
  )
  assert.ok(
    result.calls
      .slice(0, publish)
      .includes('trusted:react-native-nitro-sqlite-vec'),
  )
  assert.deepEqual(
    result.calls.filter((line) => line.startsWith('npm:')),
    [
      'npm:react-native-nitro-sqlite:publish --access public --provenance --tag latest --workspaces=false',
      'npm:react-native-nitro-sqlite-vec:publish --access public --provenance --tag latest --workspaces=false',
    ],
  )
})

test('validation failure prevents publishing either package', () => {
  const result = runPublication({ PUBLISH_TEST_FAIL_VALIDATION: '1' })
  assert.notEqual(result.status, 0)
  assert.equal(
    result.calls.some((line) => line.startsWith('npm:')),
    false,
  )
})

test('second trusted publisher failure prevents publishing either package', () => {
  const result = runPublication({ PUBLISH_TEST_FAIL_OIDC: '1' })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /OIDC exchange failed/)
  assert.equal(
    result.calls.some((line) => line.startsWith('npm:')),
    false,
  )
})

test('retry skips a package already published from the selected commit', () => {
  const result = runPublication({ PUBLISH_TEST_CORE_EXISTS: '1' })
  assert.equal(result.status, 0, result.stderr)
  const published = result.calls.filter((line) => line.startsWith('npm:'))
  assert.equal(published.length, 1)
  assert.match(published[0]!, /^npm:react-native-nitro-sqlite-vec:/)
})

function runPublication(extraEnv: Record<string, string> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'nitro-publish-test-'))
  const project = join(directory, 'project')
  const bin = join(directory, 'bin')
  const log = join(directory, 'calls.log')
  const preload = join(directory, 'network.mjs')
  try {
    mkdirSync(project)
    mkdirSync(bin)
    for (const path of [
      '.',
      'example',
      'packages/react-native-nitro-sqlite',
      'packages/react-native-nitro-sqlite-vec',
    ]) {
      mkdirSync(join(project, path), { recursive: true })
      writeFileSync(
        join(project, path, 'package.json'),
        JSON.stringify({
          version: '1.0.0',
          devDependencies: { 'react-native-nitro-sqlite': '1.0.0' },
          dependencies: {
            'react-native-nitro-sqlite': '1.0.0',
            'react-native-nitro-sqlite-vec': '1.0.0',
          },
        }),
      )
    }
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim()
    git('init', '-b', 'main')
    git('config', 'user.name', 'Christoph Pader')
    git('config', 'user.email', 'release-test@example.invalid')
    git('config', 'commit.gpgsign', 'false')
    git('add', '.')
    git('commit', '-m', 'chore: create disposable publication fixture')
    git('tag', 'v1.0.0')
    for (const command of ['bun', 'npm']) {
      writeFileSync(
        join(bin, command),
        [
          '#!/bin/bash',
          'printf "%s:%s:%s\\n" "' +
            command +
            '" "$(basename "$PWD")" "$*" >> "$PUBLISH_TEST_LOG"',
          'if [ "' +
            command +
            '" = "bun" ] && [ "$(basename "$PWD")" = "react-native-nitro-sqlite-vec" ] && [ "$*" = "run typecheck" ] && [ "$PUBLISH_TEST_FAIL_VALIDATION" = "1" ]; then exit 1; fi',
        ].join('\n'),
        { mode: 0o755 },
      )
    }
    writeFileSync(
      preload,
      [
        "import { appendFileSync, existsSync, readFileSync } from 'node:fs'",
        'globalThis.fetch = async (input) => {',
        '  const url = String(input)',
        "  if (url.startsWith('https://oidc.example.invalid')) return Response.json({ value: 'fixture-identity' })",
        "  const name = url.includes('react-native-nitro-sqlite-vec') ? 'react-native-nitro-sqlite-vec' : 'react-native-nitro-sqlite'",
        "  if (url.includes('/token/exchange/')) {",
        "    appendFileSync(process.env.PUBLISH_TEST_LOG, 'trusted:' + name + '\\n')",
        "    if (name.endsWith('-vec') && process.env.PUBLISH_TEST_FAIL_OIDC) return new Response('', { status: 403 })",
        "    return Response.json({ token: 'fixture-exchange' })",
        '  }',
        "  if (url.endsWith('/latest')) return Response.json({ version: '0.9.0' })",
        "  if (url.endsWith('/1.0.0')) {",
        "    const calls = existsSync(process.env.PUBLISH_TEST_LOG) ? readFileSync(process.env.PUBLISH_TEST_LOG, 'utf8') : ''",
        "    if (calls.includes('npm:' + name + ':') || (name === 'react-native-nitro-sqlite' && process.env.PUBLISH_TEST_CORE_EXISTS)) return Response.json({ gitHead: process.env.PUBLISH_TEST_COMMIT })",
        "    return new Response('', { status: 404 })",
        '  }',
        "  throw new Error('Unexpected network request: ' + url)",
        '}',
      ].join('\n'),
    )
    const result = spawnSync(
      process.execPath,
      ['--import', preload, script, '1.0.0'],
      {
        cwd: project,
        encoding: 'utf8',
        env: {
          ...process.env,
          ...extraEnv,
          PATH: bin + ':' + process.env.PATH,
          PUBLISH_TEST_LOG: log,
          PUBLISH_TEST_COMMIT: git('rev-parse', 'HEAD'),
          ACTIONS_ID_TOKEN_REQUEST_URL: 'https://oidc.example.invalid/token',
          ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-request',
        },
      },
    )
    return {
      status: result.status,
      stderr: result.stderr,
      calls: readFileSync(log, 'utf8').trim().split('\n'),
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
