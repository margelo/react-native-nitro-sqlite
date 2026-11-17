module.exports = {
  root: true,
  extends: '../../config/.eslintrc.js',
  parserOptions: { project: true, tsconfigRootDir: __dirname },
  rules: { 'jest/no-disabled-tests': 'off', 'jest/expect-expect': 'off' },
}
