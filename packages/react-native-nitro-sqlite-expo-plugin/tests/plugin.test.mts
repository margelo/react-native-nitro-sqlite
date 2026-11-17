import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import type { ExportedConfig, Mod } from 'expo/config-plugins.js'

const require = createRequire(import.meta.url)
const plugin: typeof import('../src/index.js').default = require('../app.plugin.js')
const vec: typeof import('../src/vec.js').default = require('../vec/app.plugin.js')
const app = { name: 'NitroSQLitePluginTest', slug: 'nitro-sqlite-plugin-test' }

test('validates options from JavaScript and JSON before registering mods', () => {
  const invalid: unknown[] = [
    false,
    [],
    { fts5: 'true' },
    { ios: [] },
    { ios: { appGroup: 'com.example' } },
    { ios: { appGroup: 'group.a/../../' } },
    { ios: { useSystemSqlite: 1 } },
    { sqliteVec: true },
    { sqliteFlags: { ios: 'SQLITE_ENABLE_FTS5=1' } },
    { sqliteFlags: { android: ['SQLITE_ENABLE_FTS5=1'] } },
    { sqliteFlags: { ios: ['SQLITE_ENABLE_FTS5=1 -DSQLITE_THREADSAFE=0'] } },
    { sqliteFlags: { ios: ['SQLITE_THREADSAFE=0'] } },
    { sqliteFlags: { android: ['-DSQLITE_CORE=1'] } },
    { sqliteFlags: { ios: ['SQLITE_ENABLE_FTS5=1', 'SQLITE_ENABLE_FTS5=0'] } },
    { fts5: true, sqliteFlags: { android: ['-DSQLITE_ENABLE_FTS5=0'] } },
    { fts5: true, ios: { useSystemSqlite: true } },
    {
      sqliteFlags: { ios: ['SQLITE_ENABLE_GEOPOLY=1'] },
      ios: { useSystemSqlite: true },
    },
  ]
  for (const options of invalid) {
    assert.throws(
      () => require('../app.plugin.js')({ ...app }, options),
      Error,
      JSON.stringify(options),
    )
  }
})

test('omitted options preserve native defaults and existing manual configuration', async () => {
  const config: ExportedConfig = plugin({ ...app }, undefined)
  const properties = {
    'unrelated.key': 'value',
    'nitroSqlite.useSystemSqlite': 'true',
  }
  assert.deepEqual(
    await run(config.mods?.ios?.podfileProperties, properties),
    properties,
  )
  const gradle = [
    {
      type: 'property' as const,
      key: 'nitroSqliteFlags',
      value: '"-DSQLITE_ENABLE_FTS5=1"',
    },
  ]
  assert.deepEqual(
    await run(config.mods?.android?.gradleProperties, gradle, 'android'),
    gradle,
  )
  assert.equal(config.mods?.ios?.infoPlist, undefined)
  assert.equal(config.mods?.ios?.entitlements, undefined)
})

test('FTS5 and advanced flags merge with manual settings and remain idempotent', async () => {
  const config: ExportedConfig = plugin(
    { ...app },
    {
      fts5: true,
      sqliteFlags: {
        ios: ['SQLITE_ENABLE_GEOPOLY=1', 'SQLITE_ENABLE_GEOPOLY=1'],
        android: ['-DSQLITE_ENABLE_GEOPOLY=1'],
      },
    },
  )
  const ios = await run(config.mods?.ios?.podfileProperties, {
    'nitroSqlite.flags': 'SQLITE_ENABLE_FTS5=1',
    'unrelated': 'keep',
  })
  assert.equal(
    ios['nitroSqlite.flags'],
    'SQLITE_ENABLE_FTS5=1 SQLITE_ENABLE_GEOPOLY=1',
  )
  assert.deepEqual(await run(config.mods?.ios?.podfileProperties, ios), ios)
  const gradle = await run(
    config.mods?.android?.gradleProperties,
    [
      { type: 'comment', value: 'keep me' },
      { type: 'property', key: 'unrelated', value: 'keep' },
      {
        type: 'property',
        key: 'nitroSqliteFlags',
        value: '"-DSQLITE_ENABLE_FTS5=1"',
      },
      {
        type: 'property',
        key: 'nitroSqliteFlags',
        value: '-DSQLITE_ENABLE_FTS5=1',
      },
    ],
    'android',
  )
  assert.deepEqual(gradle, [
    { type: 'comment', value: 'keep me' },
    { type: 'property', key: 'unrelated', value: 'keep' },
    {
      type: 'property',
      key: 'nitroSqliteFlags',
      value: '-DSQLITE_ENABLE_FTS5=1 -DSQLITE_ENABLE_GEOPOLY=1',
    },
  ])
  assert.deepEqual(
    await run(config.mods?.android?.gradleProperties, gradle, 'android'),
    gradle,
  )
  await assert.rejects(
    run(config.mods?.ios?.podfileProperties, {
      'nitroSqlite.flags': 'SQLITE_ENABLE_FTS5=0',
    }),
    /Conflicting/,
  )
  await assert.rejects(
    run(
      config.mods?.android?.gradleProperties,
      [
        {
          type: 'property',
          key: 'nitroSqliteFlags',
          value: '-DSQLITE_ENABLE_FTS5=0',
        },
      ],
      'android',
    ),
    /Conflicting/,
  )
  await assert.rejects(
    run(config.mods?.ios?.podfileProperties, {
      'nitroSqlite.useSystemSqlite': 'true',
    }),
    /disable/,
  )
})

test('App Groups preserve app-owned entitlements and reject plist conflicts', async () => {
  const config: ExportedConfig = plugin(
    { ...app },
    { ios: { appGroup: 'group.com.example.shared' } },
  )
  const plist = await run(config.mods?.ios?.infoPlist, { CFBundleName: 'Keep' })
  assert.equal(plist.RNNitroSQLite_AppGroup, 'group.com.example.shared')
  const key = 'com.apple.security.application-groups'
  const entitlements = await run(config.mods?.ios?.entitlements, {
    [key]: ['group.com.example.other'],
    'aps-environment': 'development',
  })
  assert.deepEqual(entitlements[key], [
    'group.com.example.other',
    'group.com.example.shared',
  ])
  assert.equal(entitlements['aps-environment'], 'development')
  assert.deepEqual(
    await run(config.mods?.ios?.entitlements, entitlements),
    entitlements,
  )
  await assert.rejects(
    run(config.mods?.ios?.infoPlist, {
      RNNitroSQLite_AppGroup: 'group.com.example.other',
    }),
    /conflicts/,
  )
  await assert.rejects(
    run(config.mods?.ios?.entitlements, { [key]: 'group.com.example.other' }),
    /array/,
  )
})

test('system SQLite is explicit and rejects manual linkage conflicts', async () => {
  const config: ExportedConfig = plugin(
    { ...app },
    { ios: { useSystemSqlite: true } },
  )
  assert.deepEqual(await run(config.mods?.ios?.podfileProperties, {}), {
    'nitroSqlite.useSystemSqlite': 'true',
  })
  await assert.rejects(
    run(config.mods?.ios?.podfileProperties, {
      'nitroSqlite.useSystemSqlite': 'false',
    }),
    /conflicts/,
  )
})

test('vector entry requires the companion and sets both native switches without duplicates', async () => {
  const config: ExportedConfig = vec({ ...app })
  const missing = mkdtempSync(join(tmpdir(), 'nitro-vec-missing-'))
  try {
    await assert.rejects(
      run(config.mods?.ios?.podfileProperties, {}, 'ios', missing),
      /Install react-native-nitro-sqlite-vec/,
    )
    await assert.rejects(
      run(config.mods?.android?.gradleProperties, [], 'android', missing),
      /Install react-native-nitro-sqlite-vec/,
    )
    mkdirSync(join(missing, 'node_modules/react-native-nitro-sqlite-vec'), {
      recursive: true,
    })
    writeFileSync(
      join(missing, 'node_modules/react-native-nitro-sqlite-vec/package.json'),
      '{}',
    )
    const ios = await run(
      config.mods?.ios?.podfileProperties,
      {},
      'ios',
      missing,
    )
    assert.equal(ios['nitroSqlite.vec'], 'true')
    assert.deepEqual(
      await run(config.mods?.ios?.podfileProperties, ios, 'ios', missing),
      ios,
    )
    const android = await run(
      config.mods?.android?.gradleProperties,
      [],
      'android',
      missing,
    )
    assert.deepEqual(android, [
      { type: 'property', key: 'nitroSqliteVec', value: 'true' },
    ])
    assert.deepEqual(
      await run(
        config.mods?.android?.gradleProperties,
        android,
        'android',
        missing,
      ),
      android,
    )
    await assert.rejects(
      run(
        config.mods?.ios?.podfileProperties,
        { 'nitroSqlite.vec': 'false' },
        'ios',
        missing,
      ),
      /must be true/,
    )
    await assert.rejects(
      run(
        config.mods?.android?.gradleProperties,
        [{ type: 'property', key: 'nitroSqliteVec', value: 'false' }],
        'android',
        missing,
      ),
      /must be true/,
    )
  } finally {
    rmSync(missing, { recursive: true, force: true })
  }
})

async function run<T>(
  mod: Mod<T> | undefined,
  data: T,
  platform: 'ios' | 'android' = 'ios',
  projectRoot = resolve('../..'),
): Promise<T> {
  assert.ok(mod)
  const result = await mod({
    ...app,
    modResults: data,
    modRawConfig: app,
    modRequest: {
      projectRoot,
      platformProjectRoot: join(projectRoot, platform),
      modName: 'test',
      platform,
      introspect: false,
    },
  })
  return result.modResults
}
