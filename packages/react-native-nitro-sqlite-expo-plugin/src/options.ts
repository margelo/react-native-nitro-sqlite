import type { NitroSQLitePluginOptions } from './types'

/** @internal Validate JavaScript/JSON options before registering any native mods. */
export function parseOptions(input: unknown): NitroSQLitePluginOptions {
  const options = object(input ?? {}, ['fts5', 'sqliteFlags', 'ios'], 'options')
  const fts5 = boolean(options.fts5, 'fts5')
  const sqliteFlags = object(
    options.sqliteFlags ?? {},
    ['ios', 'android'],
    'sqliteFlags',
  )
  const ios = object(options.ios ?? {}, ['appGroup', 'useSystemSqlite'], 'ios')
  const iosFlags = flags(sqliteFlags.ios, '', 'sqliteFlags.ios')
  const androidFlags = flags(sqliteFlags.android, '-D', 'sqliteFlags.android')
  const useSystemSqlite = boolean(ios.useSystemSqlite, 'ios.useSystemSqlite')
  const appGroup = ios.appGroup
  if (
    appGroup !== undefined &&
    (typeof appGroup !== 'string' ||
      !/^group\.[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*$/.test(appGroup))
  ) {
    throw new Error(
      'ios.appGroup must be an App Group identifier such as group.com.example.shared.',
    )
  }
  if (useSystemSqlite && (fts5 || iosFlags.length)) {
    throw new Error(
      'ios.useSystemSqlite cannot be combined with fts5 or sqliteFlags.ios. System SQLite is compiled by Apple.',
    )
  }
  return {
    fts5,
    sqliteFlags: { ios: iosFlags, android: androidFlags },
    ios: { appGroup, useSystemSqlite },
  }
}

/** @internal Merge definitions by macro name, preserving manual settings and rejecting conflicts. */
export function mergeFlags(
  existing: string[],
  additions: string[],
  prefix: string,
): string[] {
  const definitions = new Map<string, string>()
  for (const flag of [...existing, ...additions]) {
    const name = flag.slice(prefix.length).replace(/[=].*/, '')
    const previous = definitions.get(name)
    if (previous !== undefined && previous !== flag) {
      throw new Error(
        `Conflicting SQLite definitions for ${name}: ${previous} and ${flag}. Remove one definition.`,
      )
    }
    definitions.set(name, flag)
  }
  return [...definitions.values()]
}

// These belong to the native library's package.json configuration or its ABI.
const reserved = new Set([
  'SQLITE_THREADSAFE',
  'THREADSAFE',
  'SQLITE_CORE',
  'SQLITE_VEC_STATIC',
  'SQLITE_ENABLE_RTREE',
  'SQLITE_ENABLE_BATCH_ATOMIC_WRITE',
  'HAVE_FDATASYNC',
  'HAVE_FULLFSYNC',
  'SQLITE_DQS',
  'SQLITE_DEFAULT_MEMSTATUS',
  'SQLITE_DEFAULT_WAL_SYNCHRONOUS',
  'SQLITE_LIKE_DOESNT_MATCH_BLOBS',
  'SQLITE_MAX_EXPR_DEPTH',
  'SQLITE_OMIT_DEPRECATED',
  'SQLITE_OMIT_PROGRESS_CALLBACK',
  'SQLITE_OMIT_SHARED_CACHE',
  'SQLITE_USE_ALLOCA',
  'SQLITE_OMIT_MUTEX',
  'SQLITE_OMIT_AUTOINIT',
])

function flags(input: unknown, prefix: string, field: string): string[] {
  if (input === undefined) return []
  if (!Array.isArray(input))
    throw new Error(`${field} must be an array of compile definitions.`)
  const result: string[] = []
  for (const value of input) {
    if (
      typeof value !== 'string' ||
      !value.startsWith(prefix) ||
      !/^(?:SQLITE_|HAVE_)[A-Z0-9_]+=(-?\d+|[A-Z_][A-Z0-9_]*)$/.test(
        value.slice(prefix.length),
      )
    ) {
      throw new Error(
        `${field} entries must use ${prefix}SQLITE_OPTION=VALUE with an integer or identifier value.`,
      )
    }
    const name = value.slice(prefix.length).replace(/[=].*/, '')
    if (reserved.has(name))
      throw new Error(
        `${name} is reserved. Use the documented nitroSQLite package.json settings instead.`,
      )
    result.push(value)
  }
  return mergeFlags([], result, prefix)
}

function object(
  input: unknown,
  keys: string[],
  field: string,
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error(`${field} must be an object.`)
  for (const key of Object.keys(input)) {
    if (!keys.includes(key))
      throw new Error(
        `Unknown ${field} option ${key}. For sqlite-vec, use react-native-nitro-sqlite-expo-plugin/vec.`,
      )
  }
  return input as Record<string, unknown>
}

function boolean(input: unknown, field: string): boolean | undefined {
  if (input === undefined || typeof input === 'boolean') return input
  throw new Error(`${field} must be true or false.`)
}
