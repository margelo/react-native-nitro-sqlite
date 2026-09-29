import 'react-native-get-random-values'
import { Buffer as NodeBuffer } from 'buffer'

if (globalThis.process == null) {
  // @ts-expect-error React Native does not define Node's process global.
  globalThis.process = {}
}

globalThis.process.cwd ??= () => ''
globalThis.process.env ??= { NODE_ENV: 'production' }
globalThis.Buffer = NodeBuffer
