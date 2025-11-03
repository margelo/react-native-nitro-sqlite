import { Buffer as CraftzdogBuffer } from '@craftzdog/react-native-buffer'

declare global {
  var Buffer: typeof CraftzdogBuffer
}

if (!globalThis.process) {
  // @ts-expect-error
  globalThis.process = {}
}

globalThis.Buffer = CraftzdogBuffer
globalThis.process.cwd = () => 'sxsx'
globalThis.process.env = { NODE_ENV: 'production' }
