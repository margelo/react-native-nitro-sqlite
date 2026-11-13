# Changelog

## [11.0.0-nitro-v1.0](https://github.com/margelo/react-native-nitro-sqlite/compare/v10.2.0...v11.0.0-nitro-v1.0) (2026-11-13)


### ⚠ BREAKING CHANGES

* **ios:** iOS apps must build with Swift Package Manager and Xcode with Swift 6.4 or newer.
* Requires React Native 0.88 and Nitro V1.

### build

* **ios:** build with Swift Package Manager ([f48b970](https://github.com/margelo/react-native-nitro-sqlite/commit/f48b9704ae90d9ec8adb5a408af9f878d3e6a44d))


### ✨ Features

* migrate to Nitro V1 ([38dbe78](https://github.com/margelo/react-native-nitro-sqlite/commit/38dbe788526b052c77970fdc5eebf7b7bc7f4980))


### 🐛 Bug Fixes

* **ci:** keep hyphenated prerelease versions intact in release PRs ([e7b94c3](https://github.com/margelo/react-native-nitro-sqlite/commit/e7b94c30d4cb7793f6384bbb77b375611a2ed5d5))
* **vec:** accept Nitro V1 prereleases of the core package ([e80d5e0](https://github.com/margelo/react-native-nitro-sqlite/commit/e80d5e01ee9a63573a10193ef746b192485cfa7c))
* wait for asynchronous row batch delivery ([92744b3](https://github.com/margelo/react-native-nitro-sqlite/commit/92744b36658363ff2cca6a65495b764bef285cc3))


### 🔄 Code Refactoring

* encode query results with AnyJSON ([14812ba](https://github.com/margelo/react-native-nitro-sqlite/commit/14812bac81e7f804a63ab5f8764fbb98a6697ef8))
* rename the prepared statement hybrid object ([b4b1317](https://github.com/margelo/react-native-nitro-sqlite/commit/b4b1317dcff944cf4e60dc94b28acc91cdc95222))
* replace NitroSQLiteOnLoad with a platform context ([537737b](https://github.com/margelo/react-native-nitro-sqlite/commit/537737bc99a7479c6523ebf0ecc275d892673af6))
* shorten SQLite type and helper names ([73023ec](https://github.com/margelo/react-native-nitro-sqlite/commit/73023ec85ecede77a0f5712f12d0fe6e467f6a9b))


### 🏗️ Project configuration and build flow

* **example:** replace react-native-quick-crypto with buffer ([5a8e3f1](https://github.com/margelo/react-native-nitro-sqlite/commit/5a8e3f13283b63cc9800b2c7f7d6eaf4b4fe539b))
* **example:** upgrade to React Native 0.88 ([#455](https://github.com/margelo/react-native-nitro-sqlite/issues/455)) ([1311185](https://github.com/margelo/react-native-nitro-sqlite/commit/1311185ed40278e03bab4455234aa38a4a31def5))


### 📚 Documentation

* consolidate shared SQLite configuration ([#444](https://github.com/margelo/react-native-nitro-sqlite/issues/444)) ([aa2ab2f](https://github.com/margelo/react-native-nitro-sqlite/commit/aa2ab2f6eeb3925df595998ae60f7499897833e7))
* document the Nitro V1 setup ([fb786ed](https://github.com/margelo/react-native-nitro-sqlite/commit/fb786edfe7edb1d95fee1e1ea71bc1a8f0158cda))
* separate SQLite concepts from NitroSQLite guides ([#445](https://github.com/margelo/react-native-nitro-sqlite/issues/445)) ([8137684](https://github.com/margelo/react-native-nitro-sqlite/commit/813768484e28ae412095c336479ddfa73036fec3))

## [10.2.0](https://github.com/margelo/react-native-nitro-sqlite/compare/v10.1.0...v10.2.0) (2026-10-12)


### 🛠️ Dependency Upgrades

* **deps:** bump actions/download-artifact from 4 to 8 ([#437](https://github.com/margelo/react-native-nitro-sqlite/issues/437)) ([8f38649](https://github.com/margelo/react-native-nitro-sqlite/commit/8f38649c437160454b40ec91d70e277d38427d0a))
* **deps:** bump actions/upload-artifact from 4 to 7 ([#438](https://github.com/margelo/react-native-nitro-sqlite/issues/438)) ([251e509](https://github.com/margelo/react-native-nitro-sqlite/commit/251e509b4cc8166cbb64a14c8a2e5e763b9693d1))


### ✨ Features

* expose error type constants ([#441](https://github.com/margelo/react-native-nitro-sqlite/issues/441)) ([74c7409](https://github.com/margelo/react-native-nitro-sqlite/commit/74c7409d6c3834cf6b7c7bf6ad065a6f493fc59f))


### 💨 Performance Improvements

* improve query and write performance ([#440](https://github.com/margelo/react-native-nitro-sqlite/issues/440)) ([47e0ea5](https://github.com/margelo/react-native-nitro-sqlite/commit/47e0ea5a25c4e1d9de28204576e3d7e0409e472f))


### 🐛 Bug Fixes

* reject SQL containing more than one statement ([#439](https://github.com/margelo/react-native-nitro-sqlite/issues/439)) ([c6d6aab](https://github.com/margelo/react-native-nitro-sqlite/commit/c6d6aab4ee131716d4f71cc9d53ef60b12dc4e47)), closes [#3](https://github.com/margelo/react-native-nitro-sqlite/issues/3)


### 🏗️ Project configuration and build flow

* **deps-dev:** upgrade Mocha to 12 in the example ([#418](https://github.com/margelo/react-native-nitro-sqlite/issues/418)) ([6c47743](https://github.com/margelo/react-native-nitro-sqlite/commit/6c4774364711048e104428d71eb64bfa40ca374e))
