const path = require('path')
const pak = require('../package/package.json')

module.exports = {
  dependencies: {
    [pak.name]: {
      root: path.join(__dirname, '../package'),
    },
  },
}
