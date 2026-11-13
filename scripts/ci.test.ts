import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { matchesPaths, selectChecks } from './ci.ts'

const root = fileURLToPath(new URL('../', import.meta.url))

test('documentation content only selects the documentation build', () => {
  const checks = selectChecks(['docs/content/docs/transactions.mdx'], false)
  assert.deepEqual(enabled(checks), ['docs'])
})

test('platform changes only select their platform', () => {
  assert.deepEqual(
    enabled(selectChecks(['example/android/app/build.gradle'], false)),
    ['android', 'android_configuration'],
  )
  assert.deepEqual(enabled(selectChecks(['example/ios/Podfile'], false)), [
    'ios',
  ])
  assert.deepEqual(enabled(selectChecks(['example/macos/Podfile'], false)), [
    'macos',
  ])
})

test('shared native sources retain lifecycle and platform coverage', () => {
  const checks = selectChecks(
    ['packages/react-native-nitro-sqlite/cpp/SQLiteDatabaseConnections.cpp'],
    false,
  )
  assert.deepEqual(enabled(checks), [
    'cpp_format',
    'cpp_tests',
    'android',
    'ios',
    'macos',
  ])
})

test('generated platform bindings do not trigger the other mobile platform', () => {
  const checks = selectChecks(
    [
      'packages/react-native-nitro-sqlite/nitrogen/generated/android/JHybridNitroSQLiteSpec.hpp',
    ],
    false,
  )
  assert.equal(checks.android, true)
  assert.equal(checks.ios, false)
})

test('JavaScript unit tests do not rebuild native apps', () => {
  const checks = selectChecks(
    ['packages/react-native-nitro-sqlite/src/__tests__/transaction.test.ts'],
    false,
  )
  assert.equal(checks.typescript, true)
  assert.equal(checks.android, false)
  assert.equal(checks.ios, false)
  assert.equal(checks.macos, false)
})

test('in-app tests and sqlite-vec wrappers retain native coverage', () => {
  for (const file of [
    'example/src/tests/connection.test.ts',
    'packages/react-native-nitro-sqlite-vec/src/index.ts',
  ]) {
    const checks = selectChecks([file], false)
    assert.equal(checks.android, true)
    assert.equal(checks.ios, true)
    assert.equal(checks.macos, true)
  }
})

test('dependency lockfile changes retain both mobile and desktop coverage', () => {
  const checks = selectChecks(['bun.lock'], false)
  assert.equal(checks.android, true)
  assert.equal(checks.ios, true)
  assert.equal(checks.macos, true)
})

test('Harness patches retain both mobile and desktop coverage', () => {
  const checks = selectChecks(
    ['patches/@react-native-harness+cli+1.6.0.patch'],
    false,
  )
  assert.equal(checks.android, true)
  assert.equal(checks.ios, true)
  assert.equal(checks.macos, true)
})

test('Ruby dependency changes only select macOS', () => {
  const checks = selectChecks(['example/Gemfile'], false)
  assert.equal(checks.macos, true)
  assert.equal(checks.ios, false)
  assert.equal(checks.android, false)
})

test('Swift package changes select iOS without Android', () => {
  for (const file of [
    'packages/react-native-nitro-sqlite/Package.swift',
    'packages/react-native-nitro-sqlite-vec/Package.swift',
    'patches/react-native-screens+4.30.0.patch',
  ]) {
    const checks = selectChecks([file], false)
    assert.equal(checks.ios, true)
    assert.equal(checks.android, false)
  }
})

test('a full run selects every check even without file changes', () => {
  assert.ok(Object.values(selectChecks([], true)).every(Boolean))
})

test('ordered exclusions can be followed by explicit inclusions', () => {
  assert.equal(
    matchesPaths('src/tests/special.ts', [
      'src/**',
      '!src/tests/**',
      'src/tests/special.ts',
    ]),
    true,
  )
  assert.equal(
    matchesPaths('src/tests/other.ts', [
      'src/**',
      '!src/tests/**',
      'src/tests/special.ts',
    ]),
    false,
  )
})

test('the CLI routes real Git commits', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nitro-ci-routing-'))
  try {
    execFileSync('git', ['init', '-q'], { cwd: directory })
    writeFileSync(join(directory, 'package.json'), '{}\n')
    execFileSync('git', ['add', '.'], { cwd: directory })
    execFileSync(
      'git',
      [
        '-c',
        'user.name=CI Test',
        '-c',
        'user.email=ci@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-qm',
        'chore: create fixture',
      ],
      { cwd: directory },
    )
    const base = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: directory,
      encoding: 'utf8',
    }).trim()
    writeFileSync(join(directory, 'package.json'), '{"changed":true}\n')
    execFileSync('git', ['add', '.'], { cwd: directory })
    execFileSync(
      'git',
      [
        '-c',
        'user.name=CI Test',
        '-c',
        'user.email=ci@example.invalid',
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-qm',
        'chore: update fixture',
      ],
      { cwd: directory },
    )
    const output = join(directory, 'output')
    execFileSync(process.execPath, [join(root, 'scripts/ci.ts')], {
      cwd: directory,
      env: {
        ...process.env,
        CI_BASE_SHA: base,
        CI_FULL: 'false',
        GITHUB_OUTPUT: output,
      },
    })
    const values = readFileSync(output, 'utf8')
    assert.match(values, /typescript=true\n/)
    assert.match(values, /android=true\n/)
    assert.match(values, /dependencies=true\n/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('the routine iOS matrix uses Xcode 27', () => {
  const workflow = readFileSync(
    join(root, '.github/workflows/test-harness-ios.yml'),
    'utf8',
  )
  const match = workflow.match(
    /fromJSON\(inputs.full && '([^']+)' \|\| '([^']+)'\)/,
  )
  assert.ok(match?.[2])
  const matrix: unknown = JSON.parse(match[2])
  assert.deepEqual(matrix, [{ xcode: '27.0' }])
})

function enabled(checks: ReturnType<typeof selectChecks>): string[] {
  return Object.entries(checks)
    .filter(([, selected]) => selected)
    .map(([name]) => name)
}
