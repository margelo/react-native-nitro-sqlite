const path = require('path')
const libraryPackage = require('../packages/react-native-nitro-sqlite/package.json')

function createExampleBabelConfig(projectRoot, { buffer, crypto } = {}) {
  const sourceDirectory = path.join(projectRoot, 'src')
  const testsDirectory = path.join(projectRoot, 'tests')
  const aliases = {
    [libraryPackage.name]: path.join(
      __dirname,
      '../packages/react-native-nitro-sqlite',
      libraryPackage.source,
    ),
    'stream': 'readable-stream',
    'react-native-sqlite-storage': libraryPackage.name,
    '^@/(.+)': `${sourceDirectory}/\\1`,
    '^@tests/(.+)': `${testsDirectory}/\\1`,
  }

  if (buffer !== false) {
    aliases.buffer = buffer ?? 'react-native-quick-crypto'
  }

  if (crypto !== false) {
    aliases.crypto = crypto ?? 'react-native-quick-crypto'
  }

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      [
        'module-resolver',
        {
          extensions: ['.tsx', '.ts', '.js', '.json'],
          alias: aliases,
        },
      ],
      'babel-plugin-transform-typescript-metadata',
      ['@babel/plugin-proposal-decorators', { legacy: true }],
    ],
  }
}

module.exports = createExampleBabelConfig
