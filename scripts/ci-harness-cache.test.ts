import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import type { CacheSnapshot, SavePlan } from '@react-native-harness/cache'

const cli = fileURLToPath(import.meta.resolve('@react-native-harness/cli'))
const nodeModules = fileURLToPath(new URL('../node_modules', import.meta.url))

test('large Metro snapshots pass between steps without exceeding Linux environment limits', () => {
  const root = cacheFixture(1400)
  try {
    const snapshotOutput = join(root, 'snapshot-output')
    runCi(root, 'snapshot-metro', { GITHUB_OUTPUT: snapshotOutput })
    const snapshotPath = readOutput(snapshotOutput, 'metroSnapshot')
    assert.ok(Buffer.byteLength(snapshotPath) < 4096)
    const snapshot = readFileSync(snapshotPath, 'utf8')
    assert.ok(Buffer.byteLength(snapshot) > 128 * 1024)
    assert.equal((JSON.parse(snapshot) as CacheSnapshot).metro?.length, 1400)

    const env = { INPUT_METRO_SNAPSHOT: snapshotPath }
    const unchanged = planSave(root, env)
    assert.equal(unchanged.shouldSave, 'false')
    assert.match(unchanged.stdout, /Metro cache: unchanged/)
    assert.deepEqual(unchanged.delta, {
      addedEntries: 0,
      removedEntries: 0,
      addedBytes: 0,
    })

    writeFileSync(join(root, '.harness/cache/metro/new-transform'), 'new')
    const changed = planSave(root, env)
    assert.equal(changed.shouldSave, 'true')
    assert.deepEqual(changed.delta, {
      addedEntries: 1,
      removedEntries: 0,
      addedBytes: 3,
    })

    assert.equal(
      planSave(root, {
        ...env,
        INPUT_CACHESAVEPOLICY: 'default-branch',
        IS_DEFAULT_BRANCH: 'false',
      }).shouldSave,
      'false',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('the cache planner still accepts inline JSON snapshots', () => {
  const root = cacheFixture(2)
  try {
    const output = join(root, 'snapshot-output')
    runCi(root, 'snapshot-metro', { GITHUB_OUTPUT: output })
    const snapshot = readFileSync(readOutput(output, 'metroSnapshot'), 'utf8')
    assert.equal(
      planSave(root, { INPUT_METRO_SNAPSHOT: snapshot }).shouldSave,
      'false',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function planSave(root: string, env: Record<string, string>) {
  const output = join(root, 'save-output')
  writeFileSync(output, '')
  const stdout = runCi(root, 'plan-metro-save', {
    INPUT_CACHESAVEPOLICY: 'always',
    ...env,
    GITHUB_OUTPUT: output,
  })
  const plan = JSON.parse(
    readFileSync(join(root, '.harness/cache/keys.json'), 'utf8'),
  ) as SavePlan
  assert.ok(plan.domains.metro)
  return {
    stdout,
    shouldSave: readOutput(output, 'metroShouldSave'),
    delta: plan.domains.metro.delta,
  }
}

function runCi(root: string, command: string, env: Record<string, string>) {
  const result = spawnSync(process.execPath, [cli, 'ci', command], {
    cwd: root,
    env: { ...process.env, INPUT_PROJECTROOT: root, ...env },
    encoding: 'utf8',
    timeout: 30000,
  })
  assert.equal(
    result.status,
    0,
    `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`,
  )
  assert.doesNotMatch(result.stderr, /Failed to parse the metroSnapshot input/)
  return result.stdout
}

function readOutput(path: string, key: string): string {
  const line = readFileSync(path, 'utf8')
    .split('\n')
    .find((value) => value.startsWith(`${key}=`))
  assert.ok(line, `Missing ${key} output`)
  return line.slice(key.length + 1)
}

function cacheFixture(entries: number): string {
  const root = mkdtempSync(join(tmpdir(), 'nitro harness cache '))
  symlinkSync(nodeModules, join(root, 'node_modules'), 'dir')
  writeFileSync(
    join(root, 'rn-harness.config.json'),
    JSON.stringify({
      entryPoint: 'index.js',
      appRegistryComponentName: 'CacheTest',
      runners: [
        {
          name: 'android',
          platformId: 'android',
          runner: 'unused',
          config: {},
        },
      ],
    }),
  )
  for (const domain of ['metro', 'metro-file-map']) {
    mkdirSync(join(root, '.harness/cache', domain), { recursive: true })
  }
  for (let index = 0; index < entries; index += 1) {
    const domain = index % 2 === 0 ? 'metro' : 'metro-file-map'
    writeFileSync(
      join(root, '.harness/cache', domain, `${index}-${'a'.repeat(80)}`),
      'cache',
    )
  }
  return root
}
