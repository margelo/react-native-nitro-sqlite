const path = require('path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const pak = require('../package.json')

const root = path.resolve(__dirname, '..')
const modules = Object.keys({ ...pak.peerDependencies })
const defaultConfig = getDefaultConfig(__dirname)

const config = {
  projectRoot: __dirname,
  watchFolders: [root],

  // We need to make sure that only one version is loaded for peerDependencies
  // So we blacklist them at the root, and alias them to the versions in example's node_modules
  resolver: {
    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.join(__dirname, 'node_modules', name)
      return acc
    }, {}),
    sourceExts: [...defaultConfig.resolver.sourceExts, 'sql'],
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
}

module.exports = mergeConfig(defaultConfig, config)
