const path = require('path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const pak = require('../package.json')
const libraryPackage = require('../packages/react-native-nitro-sqlite/package.json')

const root = path.resolve(__dirname, '..')
const modules = Object.keys({ ...pak.peerDependencies })

const extraNodeModules = modules.reduce((acc, name) => {
  acc[name] = path.join(__dirname, 'node_modules', name)
  return acc
}, {})

// TypeORM resolves the driver from its own source, so Babel aliases do not
// apply. Point Metro at the library source directly in this workspace.
extraNodeModules[libraryPackage.name] = path.join(
  root,
  'packages/react-native-nitro-sqlite',
  libraryPackage.source,
)

const config = {
  projectRoot: __dirname,
  watchFolders: [root],

  // We need to make sure that only one version is loaded for peerDependencies
  // So we blacklist them at the root, and alias them to the versions in example's node_modules
  resolver: {
    extraNodeModules,
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

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
