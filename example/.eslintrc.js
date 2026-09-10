module.exports = {
  root: true,
  extends: '../config/.eslintrc.js',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  overrides: [
    {
      files: ['babel.config.shared.js', 'macos/**/*.{js,mjs}'],
      parserOptions: {
        project: null,
      },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
  ],
}
