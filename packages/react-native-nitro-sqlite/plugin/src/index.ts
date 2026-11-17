import {
  type ConfigPlugin,
  withEntitlementsPlist,
  withGradleProperties,
  withInfoPlist,
  withPodfileProperties,
} from 'expo/config-plugins'
import { mergeFlags, parseOptions } from './options'
import type { NitroSQLitePluginOptions } from './types'

export type {
  NitroSQLitePluginOptions,
  NitroSQLiteIOSOptions,
  SQLiteFlags,
} from './types'

/**
 * Configure optional Nitro SQLite capabilities during Expo prebuild on iOS and Android.
 * Register `react-native-nitro-sqlite` in the app config's plugins to use it.
 * Leaves defaults and manual settings intact when options are omitted. Repeated prebuilds
 * merge flags and App Groups without duplicates. Native changes require a new app binary.
 * @param config Expo app configuration.
 * @param input FTS5, additional compile definitions, and iOS storage/linkage settings.
 * @returns Expo configuration with native file mods registered.
 * @throws For invalid options, conflicting manual settings, or bundled flags requested with system SQLite.
 */
const withNitroSQLite: ConfigPlugin<NitroSQLitePluginOptions | void> = (
  config,
  input,
) => {
  const options = parseOptions(input)
  const iosFlags = mergeFlags(
    options.sqliteFlags?.ios ?? [],
    options.fts5 ? ['SQLITE_ENABLE_FTS5=1'] : [],
    '',
  )
  const androidFlags = mergeFlags(
    options.sqliteFlags?.android ?? [],
    options.fts5 ? ['-DSQLITE_ENABLE_FTS5=1'] : [],
    '-D',
  )
  const appGroup = options.ios?.appGroup

  config = withPodfileProperties(config, (mod) => {
    if (options.ios?.useSystemSqlite !== undefined) {
      if (
        options.ios.useSystemSqlite &&
        mod.modResults['nitroSqlite.flags']?.trim()
      )
        throw new Error(
          'Remove nitroSqlite.flags before enabling ios.useSystemSqlite.',
        )
      setProperty(
        mod.modResults,
        'nitroSqlite.useSystemSqlite',
        String(options.ios.useSystemSqlite),
      )
    }
    if (iosFlags.length) {
      if (mod.modResults['nitroSqlite.useSystemSqlite'] === 'true')
        throw new Error(
          'Remove iOS compile flags or disable nitroSqlite.useSystemSqlite.',
        )
      const key = 'nitroSqlite.flags'
      mod.modResults[key] = mergeFlags(
        splitFlags(mod.modResults[key] ?? ''),
        iosFlags,
        '',
      ).join(' ')
    }
    return mod
  })
  config = withGradleProperties(config, (mod) => {
    if (!androidFlags.length) return mod
    const flags = mod.modResults.flatMap((item) =>
      item.type === 'property' && item.key === 'nitroSqliteFlags'
        ? splitFlags(item.value)
        : [],
    )
    const value = mergeFlags(flags, androidFlags, '-D').join(' ')
    mod.modResults = mod.modResults.filter(
      (item) => item.type !== 'property' || item.key !== 'nitroSqliteFlags',
    )
    mod.modResults.push({ type: 'property', key: 'nitroSqliteFlags', value })
    return mod
  })
  if (!appGroup) return config
  config = withInfoPlist(config, (mod) => {
    setProperty(mod.modResults, 'RNNitroSQLite_AppGroup', appGroup)
    return mod
  })
  return withEntitlementsPlist(config, (mod) => {
    const key = 'com.apple.security.application-groups'
    const groups: unknown = mod.modResults[key] ?? []
    if (
      !Array.isArray(groups) ||
      !groups.every((group) => typeof group === 'string')
    )
      throw new Error(`${key} must be an array of App Group identifiers.`)
    mod.modResults[key] = [...new Set([...groups, appGroup])]
    return mod
  })
}

export default withNitroSQLite

/** @internal Set a native property without silently replacing app-owned values. */
function setProperty(
  properties: Record<string, unknown>,
  key: string,
  value: string,
): void {
  if (properties[key] !== undefined && properties[key] !== value)
    throw new Error(
      `${key} conflicts with the Nitro SQLite plugin. Remove the manual value or make it match ${value}.`,
    )
  properties[key] = value
}

/** @internal Read existing flag lists, including quoted Android property values. */
function splitFlags(value: string): string[] {
  return value
    .replace(/^(["'])(.*)\1$/, '$2')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}
