// bob builds the module target with this config so it can parse the decorated .nitro.ts specs.
module.exports = {
  presets: [
    [
      'react-native-builder-bob/babel-preset',
      { modules: 'preserve', esm: true },
    ],
  ],
  parserOpts: { plugins: ['decorators'] },
}
