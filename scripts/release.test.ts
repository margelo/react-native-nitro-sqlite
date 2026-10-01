import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
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
  assert.ok(!result.calls.some((call) => call.startsWith('release 9.8.3')))
})

test('preflight runs before package publication and the final Git release', () => {
  const result = runRelease(false)

  assert.equal(result.status, 0)
  assert.deepEqual(result.calls, [
    'run check:lockfile',
    'run release-it --increment patch --release-version',
    'run release-it 9.8.3 --ci --no-git --no-github',
    'release 9.8.3 --npm.tag=legacy-9',
    'release 9.8.3 --npm.tag=legacy-9',
    'run release-it 9.8.3',
  ])
})

test('prepared v10 release publishes both packages with the latest tag', () => {
  const version = '10.0.1'
  const result = runRelease(false, ['--publish-prepared', version], version)

  assert.equal(result.status, 0)
  assert.deepEqual(result.calls, [
    'run check:lockfile',
    `release ${version} --ci --npm.tag=latest`,
    `release ${version} --ci --npm.tag=latest`,
  ])
})

test('prepared v9 releases preserve latest by tagging both packages as legacy-9', () => {
  const result = runRelease(false, ['--publish-prepared', '9.8.3'], '9.8.3')

  assert.equal(result.status, 0)
  assert.deepEqual(result.calls, [
    'run check:lockfile',
    'release 9.8.3 --ci --npm.tag=legacy-9',
    'release 9.8.3 --ci --npm.tag=legacy-9',
  ])
})

test('prepared release rejects an increment before publishing', () => {
  const result = runRelease(false, ['--publish-prepared', 'patch'])

  assert.notEqual(result.status, 0)
  assert.deepEqual(result.calls, [])
})

test('prepared release rejects an uncommitted version before publishing', () => {
  const result = runRelease(false, ['--publish-prepared', '99.0.0'])

  assert.notEqual(result.status, 0)
  assert.deepEqual(result.calls, ['run check:lockfile'])
})

function runRelease(
  failPreflight: boolean,
  args: string[] = ['--increment', 'patch'],
  preparedVersion?: string,
): {
  status: number | null
  calls: string[]
} {
  const fixture = mkdtempSync(join(tmpdir(), 'nitro-release-'))
  const logPath = join(fixture, 'calls.txt')
  const bunStub = join(fixture, 'bun')
  const gitStub = join(fixture, 'git')

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
    if (args[0] === '--publish-prepared') {
      writeFileSync(gitStub, '#!/usr/bin/env bash\nexit 1\n')
      chmodSync(gitStub, 0o755)
    }

    const cwd = preparedVersion ? join(fixture, 'project') : projectRoot
    if (preparedVersion) {
      for (const file of [
        'package.json',
        'packages/react-native-nitro-sqlite/package.json',
        'packages/react-native-nitro-sqlite-vec/package.json',
        'example/package.json',
      ]) {
        const path = join(cwd, file)
        mkdirSync(join(path, '..'), { recursive: true })
        writeFileSync(path, JSON.stringify({ version: preparedVersion }))
      }
    }

    const result = spawnSync(
      'bash',
      [join(projectRoot, 'scripts/release.sh'), ...args],
      {
        cwd,
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
      calls: existsSync(logPath)
        ? readFileSync(logPath, 'utf8').trim().split('\n')
        : [],
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
}
