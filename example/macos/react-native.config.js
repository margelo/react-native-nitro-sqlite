const path = require('path')
const libraryPackage = require('../../packages/react-native-nitro-sqlite/package.json')
const reactNativeMacOSPath = path.dirname(
  require.resolve('react-native-macos-local/package.json'),
)

module.exports = {
  reactNativePath: path.relative(__dirname, reactNativeMacOSPath),
  dependencies: {
    [libraryPackage.name]: {
      root: path.join(__dirname, '../../packages/react-native-nitro-sqlite'),
    },
  },
}
