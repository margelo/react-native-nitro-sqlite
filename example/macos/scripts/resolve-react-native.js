const Module = require('node:module')
const path = require('node:path')

const macOSProjectRoot = path.resolve(__dirname, '..')
const resolveFilename = Module._resolveFilename

Module._resolveFilename = function resolveMacOSReactNative(
  request,
  parent,
  isMain,
  options,
) {
  if (
    request === 'react' ||
    request.startsWith('react/') ||
    request === 'react-native' ||
    request.startsWith('react-native/')
  ) {
    return resolveFilename.call(
      this,
      path.join(macOSProjectRoot, 'node_modules', request),
      parent,
      isMain,
      options,
    )
  }

  return resolveFilename.call(this, request, parent, isMain, options)
}
