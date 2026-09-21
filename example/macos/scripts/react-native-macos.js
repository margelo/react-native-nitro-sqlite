#!/usr/bin/env node

const { spawnSync } = require('node:child_process')

const resolver = require.resolve('./resolve-react-native.js')
const nodeOptions = [process.env.NODE_OPTIONS, `--require=${resolver}`]
  .filter(Boolean)
  .join(' ')

const result = spawnSync(
  process.execPath,
  [
    require.resolve('react-native-macos-local/cli.js'),
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: nodeOptions } },
)

process.exit(result.status ?? 1)
