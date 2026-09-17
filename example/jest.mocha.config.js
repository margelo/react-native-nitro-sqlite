module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/{MochaSetup,TestResultTree}.test.ts'],
  transformIgnorePatterns: ['/node_modules/(?!escape-string-regexp/)'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      { presets: ['@react-native/babel-preset'] },
    ],
  },
}
