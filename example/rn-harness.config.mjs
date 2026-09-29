import {
  androidPlatform,
  androidEmulator,
} from '@react-native-harness/platform-android'
import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple'

const config = {
  entryPoint: './index.js',
  appRegistryComponentName: 'NitroSQLiteExample',

  runners: [
    androidPlatform({
      name: 'android',
      device: androidEmulator('Pixel_7_Pro_Google_APIs_Android_15_API_35', {
        apiLevel: 35,
        profile: 'pixel_7_pro',
        diskSize: '6G',
        heapSize: '1G',
        snapshot: {
          enabled: true,
        },
      }),
      bundleId: 'com.margelo.rnnitrosqlite.example',
    }),
    applePlatform({
      name: 'ios',
      device: appleSimulator(
        process.env.IOS_SIMULATOR_NAME ?? 'iPhone 17 Pro',
        process.env.IOS_SIMULATOR_OS ?? '26.5',
      ),
      bundleId: 'com.margelo.rnnitrosqlite.example',
    }),
  ],

  defaultRunner: 'android',
  bridgeTimeout: 300000,

  resetEnvironmentBetweenTestFiles: true,
  unstable__skipAlreadyIncludedModules: false,
}

export default config
