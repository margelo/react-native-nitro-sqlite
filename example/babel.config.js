const path = require('path')
const pak = require('../packages/react-native-nitro-sqlite/package.json')

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        extensions: ['.tsx', '.ts', '.js', '.json'],
        alias: {
          [pak.name]: path.join(
            __dirname,
            '../packages/react-native-nitro-sqlite',
            pak.source,
          ),
          'stream': 'stream-browserify',
          'react-native-sqlite-storage': 'react-native-nitro-sqlite',
        },
      },
    ],
    'babel-plugin-transform-typescript-metadata',
    ['@babel/plugin-proposal-decorators', { legacy: true }],
  ],
}
