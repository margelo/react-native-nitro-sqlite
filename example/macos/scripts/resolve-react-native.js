const Module = require('node:module')
const path = require('node:path')

const macOSProjectRoot = path.resolve(__dirname, '..')
const resolveFilename = Module._resolveFilename

Module._resolveFilename = function resolveMacOSReactNative(
  request,
  parent,
  isMain,
  options,
) {
  if (
    request === 'react' ||
    request.startsWith('react/') ||
    request === 'react-native' ||
    request.startsWith('react-native/')
  ) {
    return resolveFilename.call(
      this,
      path.join(macOSProjectRoot, 'node_modules', request),
      parent,
      isMain,
      options,
    )
  }

  return resolveFilename.call(this, request, parent, isMain, options)
}

// React Native macOS 0.81.9 uses its project resolver for dependencies. Use
// the Apple dependency resolver so explicit macOS exclusions stay effective.
const macosConfig = require('react-native-macos-local/react-native.config.js')
const {
  getDependencyConfig,
} = require('@react-native-community/cli-platform-apple')
const resolveMacOSDependency = getDependencyConfig({ platformName: 'macos' })
const supportedDependencies = new Set([
  '@react-native-clipboard/clipboard',
  'react-native-get-random-values',
  'react-native-nitro-modules',
  'react-native-nitro-sqlite',
  'react-native-nitro-sqlite-vec',
])

macosConfig.platforms.macos.dependencyConfig = (packageRoot, config) => {
  const { name } = require(path.join(packageRoot, 'package.json'))
  if (!supportedDependencies.has(name)) return null

  return resolveMacOSDependency(packageRoot, config)
}
