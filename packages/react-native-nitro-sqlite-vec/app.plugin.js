const {
  withGradleProperties,
  withPodfileProperties,
} = require('expo/config-plugins')

/**
 * Enable sqlite-vec on iOS and Android during Expo prebuild.
 * Register `react-native-nitro-sqlite-vec` in the app config's plugins.
 * Removing it requires a clean prebuild and a native rebuild.
 * @type {import('expo/config-plugins').ConfigPlugin}
 * @throws If a manual setting disables vector search.
 */
const withNitroSQLiteVec = (config) => {
  config = withPodfileProperties(config, (mod) => {
    const key = 'nitroSqlite.vec'
    if (mod.modResults[key] !== undefined && mod.modResults[key] !== 'true')
      throw new Error(
        `${key} must be true when the sqlite-vec plugin is enabled.`,
      )
    mod.modResults[key] = 'true'
    return mod
  })
  return withGradleProperties(config, (mod) => {
    const key = 'nitroSqliteVec'
    const isOwnProperty = (item) => item.type === 'property' && item.key === key
    const disablesVectorSearch = mod.modResults.some(
      (item) => isOwnProperty(item) && item.value !== 'true',
    )
    if (disablesVectorSearch)
      throw new Error(
        `${key} must be true when the sqlite-vec plugin is enabled.`,
      )
    mod.modResults = mod.modResults.filter((item) => !isOwnProperty(item))
    mod.modResults.push({ type: 'property', key, value: 'true' })
    return mod
  })
}

module.exports = withNitroSQLiteVec
