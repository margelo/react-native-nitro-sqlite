const path = require('path');
const pak = require('../package/package.json');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        alias: {
          [pak.name]: path.join(__dirname, '../package', pak.source),
          stream: 'stream-browserify',
          'react-native-sqlite-storage': 'react-native-quick-sqlite',
        },
      },
    ],
    'babel-plugin-transform-typescript-metadata',
    ['@babel/plugin-proposal-decorators', {legacy: true}],
  ],
};
