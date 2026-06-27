// Autolink on iOS (own pod); skip Android (the core's CMake compiles these sources there).
module.exports = {
  dependency: {
    platforms: {
      ios: {},
      android: null,
    },
  },
}
