#!/usr/bin/env node

const { spawnSync } = require('node:child_process')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '..')
const resolver = require.resolve('./resolve-react-native.js')
const nodeOptions = [process.env.NODE_OPTIONS, `--require=${resolver}`]
  .filter(Boolean)
  .join(' ')

const result = spawnSync(
  process.execPath,
  [require.resolve('react-native-macos-local/cli.js'), 'config'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  },
)

if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const config = JSON.parse(result.stdout)

// React Native macOS 0.81.9 exposes the macOS project configuration but
// accidentally uses its project resolver for dependency configuration. Its
// CocoaPods integration still consumes the Apple podspec shape, so mirror the
// equivalent iOS dependency entries before CocoaPods writes the codegen input.
for (const dependency of Object.values(config.dependencies)) {
  const platforms = dependency.platforms
  if (platforms?.macos == null && platforms?.ios != null) {
    platforms.macos = platforms.ios
  }
}

process.stdout.write(JSON.stringify(config))
