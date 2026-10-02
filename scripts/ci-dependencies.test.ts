import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  nativeDependenciesChanged,
  selectPodChecks,
} from './ci-dependencies.ts'

test('JavaScript-only dependency changes skip CocoaPods', () => {
  const root = packageFixture('formatter')
  try {
    assert.equal(
      nativeDependenciesChanged(
        { formatter: ['formatter@1.0.0'] },
        { formatter: ['formatter@1.1.0'] },
        root,
      ),
      false,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('native package updates and additions require CocoaPods', () => {
  const root = packageFixture('@vendor/storage', 'ios/Storage.podspec')
  try {
    assert.equal(
      nativeDependenciesChanged(
        { storage: ['@vendor/storage@1.0.0'] },
        { storage: ['@vendor/storage@1.1.0'] },
        root,
      ),
      true,
    )
    assert.equal(
      nativeDependenciesChanged(
        {},
        { storage: ['@vendor/storage@1.1.0'] },
        root,
      ),
      true,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('native packages in isolated macOS dependencies are detected', () => {
  const root = packageFixture(
    'desktop-storage',
    'Storage.podspec',
    'example/macos',
  )
  try {
    assert.equal(
      nativeDependenciesChanged(
        { storage: ['desktop-storage@1.0.0'] },
        { storage: ['desktop-storage@2.0.0'] },
        root,
      ),
      true,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('unchanged native resolutions do not reinstall Pods for JavaScript metadata changes', () => {
  assert.equal(
    nativeDependenciesChanged(
      { native: ['react-native@0.87.1', { old: true }] },
      { native: ['react-native@0.87.1', { new: true }] },
      '/unused',
    ),
    false,
  )
})

test('removed packages conservatively require native lockfile validation', () => {
  assert.equal(
    nativeDependenciesChanged(
      { old: ['removed-package@1.0.0'] },
      {},
      '/missing',
    ),
    true,
  )
})

test('Expo modules require CocoaPods without a root podspec', () => {
  const root = packageFixture('expo-module', 'expo-module.config.json')
  try {
    assert.equal(
      nativeDependenciesChanged(
        { expo: ['expo-module@1.0.0'] },
        { expo: ['expo-module@1.0.1'] },
        root,
      ),
      true,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('invalid locked package records fail rather than silently skipping validation', () => {
  assert.throws(
    () => nativeDependenciesChanged({ broken: null }, {}, '/unused'),
    /string resolution/,
  )
})

test('Apple configuration changes only prepare the affected lockfile', () => {
  assert.deepEqual(selectPodChecks(['example/ios/Podfile'], false, false), {
    ios: true,
    macos: false,
  })
  assert.deepEqual(selectPodChecks(['example/macos/Podfile'], false, false), {
    ios: false,
    macos: true,
  })
  assert.deepEqual(selectPodChecks(['example/package.json'], false, false), {
    ios: false,
    macos: false,
  })
  assert.deepEqual(
    selectPodChecks(
      ['packages/react-native-nitro-sqlite/RNNitroSQLite.podspec'],
      false,
      false,
    ),
    { ios: true, macos: true },
  )
})

test('native dependency changes and full runs prepare both Apple lockfiles', () => {
  assert.deepEqual(selectPodChecks([], true, false), { ios: true, macos: true })
  assert.deepEqual(selectPodChecks([], false, true), { ios: true, macos: true })
})

test('direct native lockfile changes require validation before compilation', () => {
  assert.deepEqual(
    selectPodChecks(['example/ios/Podfile.lock'], false, false),
    {
      ios: true,
      macos: false,
    },
  )
  assert.deepEqual(
    selectPodChecks(['example/macos/Podfile.lock'], false, false),
    {
      ios: false,
      macos: true,
    },
  )
})

function packageFixture(
  name: string,
  nativeFile?: string,
  workspace = '',
): string {
  const root = mkdtempSync(join(tmpdir(), 'nitro-ci-dependencies-'))
  const directory = join(root, workspace, 'node_modules', name)
  mkdirSync(join(directory, 'ios'), { recursive: true })
  writeFileSync(join(directory, 'package.json'), '{}')
  if (nativeFile) {
    writeFileSync(join(directory, nativeFile), '')
  }
  return root
}
