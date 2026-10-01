const path = require('path')
const createExampleBabelConfig = require('../babel.config.shared')

module.exports = createExampleBabelConfig(path.resolve(__dirname, '..'), {
  // react-native-quick-base64 does not have a macOS native implementation.
  // Use the portable Buffer package instead of the mobile crypto polyfill.
  buffer: false,
  crypto: false,
})
