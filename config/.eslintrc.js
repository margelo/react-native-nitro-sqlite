module.exports = {
  root: true,
  ignorePatterns: [
    "**/node_modules",
    "**/lib",
    "**/.eslintrc.js",
    "**/.prettierrc.js",
    "**/jest.config.js",
    "**/babel.config.js",
    "**/metro.config.js",
    "**/react-native.config.js",
    "**/tsconfig.json"
  ],
  extends: ['@react-native', 'plugin:@typescript-eslint/recommended'],
  plugins: ['@typescript-eslint', 'prettier', 'jest'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
   'prettier/prettier': [
      'warn',
      {
        quoteProps: 'consistent',
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5',
        useTabs: false,
        semi: false,
      },
    ],
  },
}
