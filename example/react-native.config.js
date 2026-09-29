const path = require('path')
const pak = require('../packages/react-native-nitro-sqlite/package.json')

module.exports = {
  dependencies: {
    [pak.name]: {
      root: path.join(__dirname, '../packages/react-native-nitro-sqlite'),
    },
  },
}
