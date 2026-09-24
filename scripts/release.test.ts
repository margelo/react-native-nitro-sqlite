import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

test('preflight failure stops the release before either package publishes', () => {
  const result = runRelease(true)

  assert.notEqual(result.status, 0)
  assert.ok(
    result.calls.includes('run release-it --increment patch --release-version'),
  )
  assert.ok(
    result.calls.includes('run release-it 9.8.3 --ci --no-git --no-github'),
  )
  assert.ok(!result.calls.includes('release 9.8.3'))
})

test('preflight runs before package publication and the final Git release', () => {
  const result = runRelease(false)

  assert.equal(result.status, 0)
  assert.deepEqual(result.calls, [
    'run check:lockfile',
    'run release-it --increment patch --release-version',
    'run release-it 9.8.3 --ci --no-git --no-github',
    'release 9.8.3',
    'release 9.8.3',
    'run release-it 9.8.3',
  ])
})

function runRelease(failPreflight: boolean): {
  status: number | null
  calls: string[]
} {
  const fixture = mkdtempSync(join(tmpdir(), 'nitro-release-'))
  const logPath = join(fixture, 'calls.txt')
  const bunStub = join(fixture, 'bun')

  try {
    writeFileSync(
      bunStub,
      `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$RELEASE_TEST_LOG"
if [[ "$*" == *"--release-version"* ]]; then
  echo 9.8.3
fi
if [[ "$*" == *"--no-git --no-github"* && "$RELEASE_TEST_FAIL_PREFLIGHT" == 1 ]]; then
  exit 1
fi
`,
    )
    chmodSync(bunStub, 0o755)

    const result = spawnSync(
      'bash',
      ['./scripts/release.sh', '--increment', 'patch'],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fixture}:${process.env.PATH ?? ''}`,
          RELEASE_TEST_LOG: logPath,
          RELEASE_TEST_FAIL_PREFLIGHT: failPreflight ? '1' : '0',
        },
      },
    )

    return {
      status: result.status,
      calls: readFileSync(logPath, 'utf8').trim().split('\n'),
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
}
