export default {
  preset: 'react-native-harness',
  // Only run Harness tests. The legacy Mocha specs under src/tests/**/*.spec.ts
  // are registrator functions for the in-app Mocha runner, not Jest suites.
  testMatch: ['**/*.harness.{js,jsx,ts,tsx}'],
}
