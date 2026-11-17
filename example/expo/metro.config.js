// Without this file, Metro would load the parent example's metro.config.js.
const { getDefaultConfig } = require('expo/metro-config')

module.exports = getDefaultConfig(__dirname)
