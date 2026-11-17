import { createRequire } from 'node:module'
import { join } from 'node:path'
import {
  type ConfigPlugin,
  withGradleProperties,
  withPodfileProperties,
} from 'expo/config-plugins'

/**
 * Enable sqlite-vec for the installed companion package during Expo prebuild.
 * Register `react-native-nitro-sqlite-expo-plugin/vec` alongside the core plugin.
 * This opt-in sets both native switches; removing it requires a clean prebuild and rebuild.
 * @param config Expo app configuration. Mods resolve sqlite-vec from the app project root.
 * @returns Configuration with iOS and Android vector switches registered.
 * @throws If the companion package is missing or a manual switch disables vector search.
 */
const withNitroSQLiteVec: ConfigPlugin = (config) => {
  config = withPodfileProperties(config, (mod) => {
    requireCompanion(mod.modRequest.projectRoot)
    const key = 'nitroSqlite.vec'
    if (mod.modResults[key] !== undefined && mod.modResults[key] !== 'true')
      throw new Error(
        `${key} must be true when the sqlite-vec plugin is enabled.`,
      )
    mod.modResults[key] = 'true'
    return mod
  })
  return withGradleProperties(config, (mod) => {
    requireCompanion(mod.modRequest.projectRoot)
    const key = 'nitroSqliteVec'
    const existing = mod.modResults.filter(
      (item) => item.type === 'property' && item.key === key,
    )
    if (
      existing.some((item) => item.type === 'property' && item.value !== 'true')
    )
      throw new Error(
        `${key} must be true when the sqlite-vec plugin is enabled.`,
      )
    mod.modResults = mod.modResults.filter(
      (item) => item.type !== 'property' || item.key !== key,
    )
    mod.modResults.push({ type: 'property', key, value: 'true' })
    return mod
  })
}

export default withNitroSQLiteVec

function requireCompanion(projectRoot: string): void {
  try {
    createRequire(join(projectRoot, 'package.json')).resolve(
      'react-native-nitro-sqlite-vec/package.json',
    )
  } catch {
    throw new Error(
      'Install react-native-nitro-sqlite-vec before enabling react-native-nitro-sqlite-expo-plugin/vec. See https://sqlite.margelo.com/docs/configuration/expo.',
    )
  }
}
