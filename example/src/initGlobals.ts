import { Buffer as CraftzdogBuffer } from '@craftzdog/react-native-buffer'

declare global {
  // eslint-disable-next-line no-var
  var Buffer: typeof CraftzdogBuffer
}

if (!globalThis.process) {
  // @ts-expect-error - if process is not defined, we need to set it to an empty object
  globalThis.process = {}
}

globalThis.Buffer = CraftzdogBuffer
globalThis.process.cwd = () => 'sxsx'
globalThis.process.env = { NODE_ENV: 'production' }
