// CocoaPods autolinks this package on Apple platforms; Android compiles it via the core's CMake.
module.exports = {
  dependency: {
    platforms: {
      ios: {},
      macos: {},
      android: null,
    },
  },
}
