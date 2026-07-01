import {
  androidPlatform,
  physicalAndroidDevice,
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
      // Connected physical device (Samsung Galaxy M14, SM-E146B).
      // Matching is case-insensitive against `ro.product.manufacturer` /
      // `ro.product.model`, so these values must be lowercase.
      device: physicalAndroidDevice('samsung', 'sm-e146b'),
      // Fallback emulator if no physical device is attached:
      // device: androidEmulator('Pixel_8_API_35'),
      bundleId: 'com.margelo.rnnitrosqlite.example',
    }),
    applePlatform({
      name: 'ios',
      device: appleSimulator('iPhone 17 Pro', '26.5'),
      bundleId: 'com.margelo.rnnitrosqlite.example',
    }),
  ],
  defaultRunner: 'android',
  bridgeTimeout: 180000,
}

export default config
