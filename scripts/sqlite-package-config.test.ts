import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const packageDirectory = join(root, 'packages/react-native-nitro-sqlite')
const sqliteDirectory = join(packageDirectory, 'cpp/sqlite')
const environmentNames = [
  'NITRO_SQLITE_THREADSAFE',
  'NITRO_SQLITE_PERFORMANCE_MODE',
  'NITRO_SQLITE_USE_PHONE_VERSION',
]
const optimizationDefines = [
  'SQLITE_DQS=0',
  'SQLITE_DEFAULT_MEMSTATUS=0',
  'SQLITE_DEFAULT_WAL_SYNCHRONOUS=1',
  'SQLITE_LIKE_DOESNT_MATCH_BLOBS=1',
  'SQLITE_MAX_EXPR_DEPTH=0',
  'SQLITE_OMIT_DEPRECATED=1',
  'SQLITE_OMIT_PROGRESS_CALLBACK=1',
  'SQLITE_OMIT_SHARED_CACHE=1',
  'SQLITE_USE_ALLOCA=1',
]

type Environment = Record<string, string | undefined>
type Setting = { tool: string; kind: Record<string, { _0: unknown }> }
type Target = {
  name: string
  exclude: string[]
  settings: Setting[]
}

test('defaults enable thread safety, performance mode, and RTree', () => {
  const defines = definesFor({})
  assertThreadSafe(defines, '1')
  assertOptimizations(defines, true)
  assert.ok(defines.includes('SQLITE_ENABLE_RTREE=1'))
  compileAndProbe(defines, '1', true)
})

test('package.json settings choose SQLite options', () => {
  const withoutRTree = definesFor({ nitroSQLite: { enableRTree: false } })
  assert.ok(
    !withoutRTree.some((define) => define.startsWith('SQLITE_ENABLE_RTREE')),
  )
  compileAndProbe(withoutRTree, '1', false)

  const unsafe = definesFor({ nitroSQLite: { threadSafe: false } })
  assertThreadSafe(unsafe, '0')
  assertOptimizations(unsafe, true)
  compileAndProbe(unsafe, '0', true)

  const unoptimized = definesFor({ nitroSQLite: { performanceMode: false } })
  assertThreadSafe(unoptimized, '1')
  assertOptimizations(unoptimized, false)
  assert.ok(unoptimized.includes('SQLITE_ENABLE_RTREE=1'))
  compileAndProbe(unoptimized, '1', true)
})

test('environment variables override package.json settings', () => {
  assertThreadSafe(
    definesFor(
      { nitroSQLite: { threadSafe: false } },
      { NITRO_SQLITE_THREADSAFE: 'true' },
    ),
    '1',
  )
  assertThreadSafe(
    definesFor(
      { nitroSQLite: { threadSafe: true } },
      { NITRO_SQLITE_THREADSAFE: 'false' },
    ),
    '0',
  )
  assertOptimizations(
    definesFor(
      { nitroSQLite: { performanceMode: false } },
      { NITRO_SQLITE_PERFORMANCE_MODE: 'true' },
    ),
    true,
  )
  // An overridden setting is not validated.
  assertOptimizations(
    definesFor(
      { nitroSQLite: { performanceMode: 2 } },
      { NITRO_SQLITE_PERFORMANCE_MODE: 'true' },
    ),
    true,
  )
  assertOptimizations(
    definesFor(
      { nitroSQLite: { performanceMode: true } },
      { NITRO_SQLITE_PERFORMANCE_MODE: 'false' },
    ),
    false,
  )
})

test('invalid settings fail the package resolution', () => {
  assertRejected(
    { nitroSQLite: true },
    {},
    'nitroSQLite in package.json must be an object',
  )
  assertRejected(
    { nitroSQLite: { threadSafe: 1 } },
    {},
    'nitroSQLite.threadSafe in package.json must be true or false',
  )
  assertRejected(
    { nitroSQLite: { performanceMode: 1 } },
    {},
    'nitroSQLite.performanceMode in package.json must be true or false',
  )
  assertRejected(
    { nitroSQLite: { enableRTree: 'false' } },
    {},
    'nitroSQLite.enableRTree in package.json must be true or false',
  )
  assertRejected(
    {},
    { NITRO_SQLITE_THREADSAFE: '2' },
    'NITRO_SQLITE_THREADSAFE must be true, false, 1, or 0',
  )
  assertRejected(
    {},
    { NITRO_SQLITE_PERFORMANCE_MODE: 'enabled' },
    'NITRO_SQLITE_PERFORMANCE_MODE must be true, false, 1, or 0',
  )
  assertRejected(
    { nitroSQLite: { iosSqliteFlags: true } },
    {},
    'nitroSQLite.iosSqliteFlags in package.json must be a string',
  )
  assertRejected(
    { nitroSQLite: { iosSqliteFlags: '-DSQLITE_ENABLE_FTS5=1 -O2' } },
    {},
    'nitroSQLite.iosSqliteFlags in package.json must only contain -D definitions, found -O2',
  )
})

test('iosSqliteFlags add definitions and replace defaults with the same name', () => {
  const custom = definesFor({
    nitroSQLite: {
      iosSqliteFlags:
        '-DSQLITE_ENABLE_FTS5 -DSQLITE_DEFAULT_WAL_SYNCHRONOUS=2 -DTHREADSAFE=2',
    },
  })
  assert.ok(custom.includes('SQLITE_ENABLE_FTS5'))
  assert.ok(custom.includes('SQLITE_DEFAULT_WAL_SYNCHRONOUS=2'))
  assert.ok(!custom.includes('SQLITE_DEFAULT_WAL_SYNCHRONOUS=1'))
  // SQLite reads THREADSAFE when SQLITE_THREADSAFE is not defined.
  assert.ok(!custom.some((define) => define.startsWith('SQLITE_THREADSAFE=')))
  compileAndProbe(custom, '2', true)
})

test('system SQLite excludes the bundled amalgamation and links libsqlite3', () => {
  const target = sqliteTarget({}, { NITRO_SQLITE_USE_PHONE_VERSION: '1' })
  assert.ok(target.exclude.includes('cpp/sqlite/sqlite3.c'))
  assert.ok(defines(target).includes('NITRO_SQLITE_USE_PHONE_VERSION=1'))
  assert.ok(
    target.settings.some(
      (setting) =>
        setting.tool === 'linker' &&
        setting.kind.linkedLibrary?._0 === 'sqlite3',
    ),
  )
})

function definesFor(
  appPackage: object,
  environment: Environment = {},
): string[] {
  return defines(sqliteTarget(appPackage, environment))
}

function defines(target: Target): string[] {
  return target.settings
    .filter((setting) => setting.tool === 'c' && setting.kind.define)
    .map((setting) => String(setting.kind.define?._0))
}

function sqliteTarget(appPackage: object, environment: Environment): Target {
  const result = dumpPackage(appPackage, environment)
  assert.equal(result.status, 0, result.stderr)
  const manifest = JSON.parse(result.stdout) as { targets: Target[] }
  const target = manifest.targets.find(
    ({ name }) => name === 'RNNitroSQLiteCxx',
  )
  assert.ok(target, 'RNNitroSQLiteCxx target is missing')
  return target
}

function assertRejected(
  appPackage: object,
  environment: Environment,
  message: string,
): void {
  const result = dumpPackage(appPackage, environment)
  assert.notEqual(result.status, 0)
  assert.match(
    result.stderr + result.stdout,
    new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  )
}

/**
 * Evaluates Package.swift where React Native links it, `<app>/ios/build/generated/autolinking/libs/RNNitroSQLite`.
 * Each call uses a new directory, because SwiftPM caches evaluated manifests by path and contents.
 */
function dumpPackage(appPackage: object, environment: Environment) {
  const app = mkdtempSync(join(tmpdir(), 'nitro-sqlite-app-'))
  try {
    const linkedPackage = join(
      app,
      'ios/build/generated/autolinking/libs/RNNitroSQLite',
    )
    mkdirSync(linkedPackage, { recursive: true })
    writeFileSync(join(app, 'package.json'), JSON.stringify(appPackage))
    copyFileSync(
      join(packageDirectory, 'Package.swift'),
      join(linkedPackage, 'Package.swift'),
    )
    const env = { ...process.env }
    for (const name of environmentNames) delete env[name]
    return spawnSync('swift', ['package', 'dump-package'], {
      cwd: linkedPackage,
      env: { ...env, ...environment },
      encoding: 'utf8',
    })
  } finally {
    rmSync(app, { recursive: true, force: true })
  }
}

function assertThreadSafe(defines: string[], expected: string): void {
  assert.ok(
    defines.includes(`SQLITE_THREADSAFE=${expected}`),
    defines.join(' '),
  )
  assert.equal(
    defines.filter((define) => define.startsWith('SQLITE_THREADSAFE=')).length,
    1,
  )
}

function assertOptimizations(defines: string[], enabled: boolean): void {
  for (const define of optimizationDefines) {
    assert.equal(defines.includes(define), enabled, define)
  }
}

/** Compiles the bundled SQLite with the resolved defines and checks thread safety and RTree at runtime. */
function compileAndProbe(
  defines: string[],
  threadSafe: string,
  rtree: boolean,
): void {
  const directory = mkdtempSync(join(tmpdir(), 'nitro-sqlite-probe-'))
  try {
    const probe = join(directory, 'probe.c')
    const binary = join(directory, 'probe')
    writeFileSync(
      probe,
      `#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "sqlite3.h"

int main(int argc, char **argv) {
  assert(argc == 2);
  sqlite3 *db = NULL;
  assert(sqlite3_open(argv[1], &db) == SQLITE_OK);
  int rc = sqlite3_exec(db,
    "CREATE VIRTUAL TABLE SpatialIndex USING rtree(id,minX,maxX,minY,maxY)",
    NULL, NULL, NULL);
  if (${rtree ? 1 : 0}) {
    assert(rc == SQLITE_OK);
    assert(sqlite3_exec(db,
      "INSERT INTO SpatialIndex VALUES(1,10,20,30,40);"
      "CREATE TABLE Item(id INTEGER PRIMARY KEY);"
      "INSERT INTO Item VALUES(1);"
      "CREATE VIEW SpatialItems AS SELECT Item.id FROM Item JOIN SpatialIndex USING(id);"
      "CREATE VIRTUAL TABLE IntIndex USING rtree_i32(id,minX,maxX)",
      NULL, NULL, NULL) == SQLITE_OK);
    assert(sqlite3_close(db) == SQLITE_OK);
    assert(sqlite3_open(argv[1], &db) == SQLITE_OK);
    assert(sqlite3_exec(db,
      "ALTER TABLE Item RENAME TO RenamedItem;"
      "ALTER TABLE SpatialIndex RENAME TO RenamedSpatialIndex;",
      NULL, NULL, NULL) == SQLITE_OK);
    sqlite3_stmt *statement = NULL;
    assert(sqlite3_prepare_v2(db, "SELECT id FROM SpatialItems", -1, &statement, NULL) == SQLITE_OK);
    assert(sqlite3_step(statement) == SQLITE_ROW);
    assert(sqlite3_column_int(statement, 0) == 1);
    assert(sqlite3_step(statement) == SQLITE_DONE);
    assert(sqlite3_finalize(statement) == SQLITE_OK);
  } else {
    assert(rc == SQLITE_ERROR);
    assert(strcmp(sqlite3_errmsg(db), "no such module: rtree") == 0);
  }
  assert(sqlite3_close(db) == SQLITE_OK);
  printf("%d", sqlite3_threadsafe());
  return 0;
}
`,
    )
    execFileSync(process.env.CC ?? 'cc', [
      ...defines.map((define) => `-D${define}`),
      `-I${sqliteDirectory}`,
      join(sqliteDirectory, 'sqlite3.c'),
      probe,
      '-o',
      binary,
      // FTS5 calls log(), which Linux provides in libm.
      '-lm',
    ])
    assert.equal(
      execFileSync(binary, [join(directory, 'rtree.sqlite')], {
        encoding: 'utf8',
      }),
      threadSafe,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}
