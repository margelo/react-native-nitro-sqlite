// Swift Package Manager builds this package on iOS; Android compiles it via the core's CMake.
module.exports = {
  dependency: {
    platforms: {
      ios: {},
      macos: {},
      android: null,
    },
  },
}
