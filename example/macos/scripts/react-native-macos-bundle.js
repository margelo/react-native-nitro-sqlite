#!/usr/bin/env node

const unsupportedConfigOptions = new Set(['--config-cmd', '--load-config'])
const argumentsForMacOSCli = process.argv
  .slice(2)
  .filter((argument, index, args) => {
    const previousArgument = args[index - 1]

    return (
      !unsupportedConfigOptions.has(argument) &&
      !unsupportedConfigOptions.has(previousArgument)
    )
  })

async function bundleForMacOS() {
  const { spawnSync } = await import('node:child_process')
  const resolver = require.resolve('./resolve-react-native.js')
  const nodeOptions = [process.env.NODE_OPTIONS, `--require=${resolver}`]
    .filter(Boolean)
    .join(' ')
  const result = spawnSync(
    process.execPath,
    [
      require.resolve('react-native-macos-local/cli.js'),
      ...argumentsForMacOSCli,
    ],
    { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: nodeOptions } },
  )

  process.exit(result.status ?? 1)
}

bundleForMacOS().catch((error) => {
  console.error(error)
  process.exit(1)
})
