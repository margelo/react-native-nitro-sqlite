// Android compiles these sources via the core's CMake, so autolink iOS only.
module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: null,
    },
  },
}
