module.exports = {
  root: true,
  extends: '../../config/.eslintrc.js',
  ignorePatterns: ['src/__tests__/fixtures/drizzle'],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
}
