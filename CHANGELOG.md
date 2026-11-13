# Changelog

## [10.3.1](https://github.com/margelo/react-native-nitro-sqlite/compare/v10.3.0...v10.3.1) (2026-11-13)


### 🏗️ Project configuration and build flow

* **example:** bundle Drizzle fixtures in release builds ([#489](https://github.com/margelo/react-native-nitro-sqlite/issues/489)) ([b9b4cb8](https://github.com/margelo/react-native-nitro-sqlite/commit/b9b4cb80de309457ed09b0c702a574f51aafdcf9))

## [10.3.0](https://github.com/margelo/react-native-nitro-sqlite/compare/v10.2.0...v10.3.0) (2026-11-10)


### ⚠ BREAKING CHANGES

* The package no longer ships a CommonJS build. Jest setups that load react-native-nitro-sqlite/mock must add the package to transformIgnorePatterns so Jest transforms its ES modules.

### 🛠️ Dependency Upgrades

* **deps:** bump callstackincubator/react-native-harness from 1.6.0 to 1.7.0 in the actions group ([#471](https://github.com/margelo/react-native-nitro-sqlite/issues/471)) ([67cd86f](https://github.com/margelo/react-native-nitro-sqlite/commit/67cd86fb58ad9709028e448910a2fc2fb8af5254))
* **deps:** bump Nitro to 0.37.2 ([#473](https://github.com/margelo/react-native-nitro-sqlite/issues/473)) ([790742f](https://github.com/margelo/react-native-nitro-sqlite/commit/790742fac89e14447eb118244487a9c6a4569f15))
* **deps:** bump react-native-builder-bob to 0.44.1 ([#477](https://github.com/margelo/react-native-nitro-sqlite/issues/477)) ([518e79d](https://github.com/margelo/react-native-nitro-sqlite/commit/518e79d71cc0fb75712556a7e4ffe611b0376343))


### ✨ Features

* add Drizzle ORM driver ([#448](https://github.com/margelo/react-native-nitro-sqlite/issues/448)) ([cb15889](https://github.com/margelo/react-native-nitro-sqlite/commit/cb158890c0b1412b9fa7b11f2ef82f8318e52cd2))
* add executeRaw to return rows as arrays ([#447](https://github.com/margelo/react-native-nitro-sqlite/issues/447)) ([076a2ba](https://github.com/margelo/react-native-nitro-sqlite/commit/076a2ba777d791149b4eb374e740f8f9be785154))


### 🏗️ Project configuration and build flow

* **example:** benchmark app workloads and Drizzle ([#470](https://github.com/margelo/react-native-nitro-sqlite/issues/470)) ([c12b9a5](https://github.com/margelo/react-native-nitro-sqlite/commit/c12b9a5f231b0f4a4a6c62ca99716512452843c7))
* **example:** benchmark async reads and fractional REAL values ([#469](https://github.com/margelo/react-native-nitro-sqlite/issues/469)) ([1b09ac4](https://github.com/margelo/react-native-nitro-sqlite/commit/1b09ac4b282fee8e7a36d4ae74cff52aace0bc54))
* **example:** upgrade to React Native 0.88 ([#455](https://github.com/margelo/react-native-nitro-sqlite/issues/455)) ([1311185](https://github.com/margelo/react-native-nitro-sqlite/commit/1311185ed40278e03bab4455234aa38a4a31def5))
* ship ESM-only package output ([#475](https://github.com/margelo/react-native-nitro-sqlite/issues/475)) ([1e74395](https://github.com/margelo/react-native-nitro-sqlite/commit/1e74395f3133bd92d2ba680e59b5f232b9c7b0c0))


### 📚 Documentation

* announce 10.3.0 with the ESM-only breaking change ([#480](https://github.com/margelo/react-native-nitro-sqlite/issues/480)) ([56a4a62](https://github.com/margelo/react-native-nitro-sqlite/commit/56a4a6293700baae3ced975021aa0fcdebd30cb3))
* consolidate shared SQLite configuration ([#444](https://github.com/margelo/react-native-nitro-sqlite/issues/444)) ([aa2ab2f](https://github.com/margelo/react-native-nitro-sqlite/commit/aa2ab2f6eeb3925df595998ae60f7499897833e7))
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
