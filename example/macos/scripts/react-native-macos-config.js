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

process.stdout.write(result.stdout)
