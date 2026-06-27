// This package ships native sqlite-vec sources but is NOT a standalone native
// module on Android — there the core react-native-nitro-sqlite library compiles
// these sources into its own CMake target. On iOS it provides its own pod
// (RNNitroSqliteVec.podspec). So: autolink on iOS, skip Android autolinking.
module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: null,
    },
  },
}
