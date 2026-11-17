# Changelog

## [10.4.0](https://github.com/margelo/react-native-nitro-sqlite/compare/v10.3.1...v10.4.0) (2026-11-17)


### 🛠️ Dependency Upgrades

* **deps:** bump Chai to 6.3.0 ([#433](https://github.com/margelo/react-native-nitro-sqlite/issues/433)) ([c6fafff](https://github.com/margelo/react-native-nitro-sqlite/commit/c6fafff92e39cc6118f923148cd3e97f515181d1))
* **deps:** bump React Native to 0.88.1 ([#518](https://github.com/margelo/react-native-nitro-sqlite/issues/518)) ([e8d8a5c](https://github.com/margelo/react-native-nitro-sqlite/commit/e8d8a5c55961e6e0380afb01c7acb21db256eb5c))
* **deps:** bump TypeORM to 1.1.2 ([#446](https://github.com/margelo/react-native-nitro-sqlite/issues/446)) ([2630e11](https://github.com/margelo/react-native-nitro-sqlite/commit/2630e110afbeec562a2d1399101e21a7e470616a))


### ✨ Features

* add change listeners for committed row changes ([#516](https://github.com/margelo/react-native-nitro-sqlite/issues/516)) ([6664abd](https://github.com/margelo/react-native-nitro-sqlite/commit/6664abddf26f2e478284125e3780c0a33e2ab3a8))
* add Expo config plugins ([#512](https://github.com/margelo/react-native-nitro-sqlite/issues/512)) ([ad2387e](https://github.com/margelo/react-native-nitro-sqlite/commit/ad2387ecaa6b5b1d981c604cf30442cbf5118266))
* **ios:** read SQLite settings from Podfile.properties.json ([#511](https://github.com/margelo/react-native-nitro-sqlite/issues/511)) ([3465f51](https://github.com/margelo/react-native-nitro-sqlite/commit/3465f51e0b5c3aec1bb1dbee7ac227f95cec213e))


### 🐛 Bug Fixes

* **android:** apply every nitroSqliteFlags definition ([#519](https://github.com/margelo/react-native-nitro-sqlite/issues/519)) ([a3a589a](https://github.com/margelo/react-native-nitro-sqlite/commit/a3a589ad0ddba6d625a1fed99e96fc14ac953ac5))
* **macos:** declare macOS 10.15 as the minimum deployment target ([#508](https://github.com/margelo/react-native-nitro-sqlite/issues/508)) ([5bf7745](https://github.com/margelo/react-native-nitro-sqlite/commit/5bf77454ec665b0d4dfe97f7d64d1811d83b57b9))
* wait for row batches that arrive after an async result ([#515](https://github.com/margelo/react-native-nitro-sqlite/issues/515)) ([18907e6](https://github.com/margelo/react-native-nitro-sqlite/commit/18907e63bc8add39541a2ef4e703437369ac94ee))


### 🏗️ Project configuration and build flow

* **deps-dev:** bump @react-native-harness/cli to 1.7.0 ([#506](https://github.com/margelo/react-native-nitro-sqlite/issues/506)) ([486a661](https://github.com/margelo/react-native-nitro-sqlite/commit/486a6617e1bf651882c60e40b0a8743db828d7a0))
* **deps-dev:** bump @react-native-harness/platform-android to 1.7.0 ([#507](https://github.com/margelo/react-native-nitro-sqlite/issues/507)) ([f61af25](https://github.com/margelo/react-native-nitro-sqlite/commit/f61af257376b89f9ab9c146b5c385bbe539efcc4))
* **deps-dev:** support better-sqlite3 13 ([#435](https://github.com/margelo/react-native-nitro-sqlite/issues/435)) ([5e2508b](https://github.com/margelo/react-native-nitro-sqlite/commit/5e2508b1da8f0868ba8b069203f8c4bfbdb352d3))
* **example:** add an Expo example that uses the config plugins ([#520](https://github.com/margelo/react-native-nitro-sqlite/issues/520)) ([85828b4](https://github.com/margelo/react-native-nitro-sqlite/commit/85828b48da420e5352544d930b81ca4ca28c9d77))
* **example:** keep Drizzle fixtures in Metro builds without watchman ([#509](https://github.com/margelo/react-native-nitro-sqlite/issues/509)) ([cfb2f42](https://github.com/margelo/react-native-nitro-sqlite/commit/cfb2f427d376335f81579d2aa995158f7b28661f))

## [10.3.1](https://github.com/margelo/react-native-nitro-sqlite/compare/v10.3.0...v10.3.1) (2026-11-17)


### 💨 Performance Improvements

* begin deferred transactions synchronously ([#501](https://github.com/margelo/react-native-nitro-sqlite/issues/501)) ([dd43898](https://github.com/margelo/react-native-nitro-sqlite/commit/dd438984bf3b53b661d61fd1424b1d06471eb43b))
* drop promise layers around transactions ([#500](https://github.com/margelo/react-native-nitro-sqlite/issues/500)) ([a939f67](https://github.com/margelo/react-native-nitro-sqlite/commit/a939f67de512a4e3e996932505419fbe3bdca436))
* drop promise layers from async queries ([#496](https://github.com/margelo/react-native-nitro-sqlite/issues/496)) ([92a2855](https://github.com/margelo/react-native-nitro-sqlite/commit/92a28557ab54946307202b8bdf4f8475534516d3))
* drop promise layers from batch and file loading ([#499](https://github.com/margelo/react-native-nitro-sqlite/issues/499)) ([77a8667](https://github.com/margelo/react-native-nitro-sqlite/commit/77a8667b304b1a8d8f198ba1fea5e19bcdfa3b30))
* run prepared async executions on the connection worker ([#503](https://github.com/margelo/react-native-nitro-sqlite/issues/503)) ([3da8dc9](https://github.com/margelo/react-native-nitro-sqlite/commit/3da8dc95572e1a0e5bbeb467a35ec124964929f8))
* send row batches to one registered handler ([#504](https://github.com/margelo/react-native-nitro-sqlite/issues/504)) ([ed85f1a](https://github.com/margelo/react-native-nitro-sqlite/commit/ed85f1ab80109a086fe89bcd6dfcc45ceec52d1e))
* start statements directly when the queue is free ([#502](https://github.com/margelo/react-native-nitro-sqlite/issues/502)) ([4339a76](https://github.com/margelo/react-native-nitro-sqlite/commit/4339a76bdc446c5d3b40fe9d19b67bc0decaf7c3))


### 🐛 Bug Fixes

* reject loadFileAsync on a closed connection ([#498](https://github.com/margelo/react-native-nitro-sqlite/issues/498)) ([88e72ac](https://github.com/margelo/react-native-nitro-sqlite/commit/88e72acf8f0af9ff39b2cc8c5d925229126dda09))


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
