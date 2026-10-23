const path = require('path')
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const libraryPackage = require('../../packages/react-native-nitro-sqlite/package.json')

const exampleRoot = path.resolve(__dirname, '..')
const root = path.resolve(__dirname, '../..')
const reactNativeMacOSPath = path.dirname(
  require.resolve('react-native-macos-local/package.json'),
)
const extraNodeModules = Object.keys(libraryPackage.peerDependencies).reduce(
  (modules, name) => {
    modules[name] = path.join(__dirname, 'node_modules', name)
    return modules
  },
  {},
)
const defaultConfig = getDefaultConfig(__dirname)

const config = {
  projectRoot: __dirname,
  watchFolders: [exampleRoot, root],
  resolver: {
    // The example shares migration fixtures with the Drizzle package tests.
    blockList: /\/__tests__\/(?!fixtures\/).*/,
    disableHierarchicalLookup: true,
    nodeModulesPaths: [
      path.join(__dirname, 'node_modules'),
      path.join(root, 'node_modules'),
    ],
    platforms: ['macos', 'ios', 'android'],
    sourceExts: [...defaultConfig.resolver.sourceExts, 'sql'],
    extraNodeModules,
    resolveRequest: (context, moduleName, platform) => {
      // TypeORM imports the workspace package without going through Babel.
      // Resolve its source before package exports look for build artifacts.
      if (moduleName === libraryPackage.name) {
        return {
          type: 'sourceFile',
          filePath: path.join(
            root,
            'packages/react-native-nitro-sqlite/src/index.ts',
          ),
        }
      }

      if (
        platform === 'macos' &&
        (moduleName === 'react-native' ||
          moduleName.startsWith('react-native/'))
      ) {
        const relativePath =
          moduleName === 'react-native'
            ? 'index.js'
            : moduleName.slice('react-native/'.length)

        return {
          type: 'sourceFile',
          filePath: require.resolve(
            path.join(reactNativeMacOSPath, relativePath),
          ),
        }
      }

      return context.resolveRequest(context, moduleName, platform)
    },
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  serializer: {
    // Metro's default initializer resolves `react-native` before our custom
    // resolver runs. Point it at React Native macOS explicitly so its globals
    // (including `window` and `performance`) exist before the app entry runs.
    getModulesRunBeforeMainModule: () => [
      path.join(reactNativeMacOSPath, 'Libraries/Core/InitializeCore.js'),
    ],
  },
}

module.exports = mergeConfig(defaultConfig, config)
