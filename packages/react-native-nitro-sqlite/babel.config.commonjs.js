// bob builds the commonjs target with this config so it can parse the decorated .nitro.ts specs.
module.exports = {
  presets: [
    [
      'react-native-builder-bob/babel-preset',
      { modules: 'commonjs', esm: true },
    ],
  ],
  parserOpts: { plugins: ['decorators'] },
}
