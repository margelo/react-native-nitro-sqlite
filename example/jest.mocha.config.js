module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/{MochaSetup,TestResultTree}.test.ts'],
  transformIgnorePatterns: ['/node_modules/(?!(chai|escape-string-regexp)/)'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      { presets: ['@react-native/babel-preset'] },
    ],
  },
}
