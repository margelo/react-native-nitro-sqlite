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
          'crypto': 'react-native-quick-crypto',
          'stream': 'readable-stream',
          'buffer': 'react-native-quick-crypto',
          'react-native-sqlite-storage': 'react-native-nitro-sqlite',
          '^@/(.+)': './src/\\1',
          '^@tests/(.+)': './tests/\\1',
        },
      },
    ],
    'babel-plugin-transform-typescript-metadata',
    ['@babel/plugin-proposal-decorators', { legacy: true }],
  ],
}
