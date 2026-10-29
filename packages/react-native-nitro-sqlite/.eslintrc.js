module.exports = {
  root: true,
  extends: '../../config/.eslintrc.js',
  // bob's per-target Babel configs sit outside the TypeScript project, like babel.config.js.
  ignorePatterns: ['babel.config.*.js'],
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
}
