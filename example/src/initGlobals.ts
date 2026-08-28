import { Buffer as CraftzdogBuffer } from '@craftzdog/react-native-buffer'
import {
  install as installQuickCrypto,
  Buffer as QuickCryptoBuffer,
} from 'react-native-quick-crypto'

declare global {
  // eslint-disable-next-line no-var
  var Buffer: typeof CraftzdogBuffer | typeof QuickCryptoBuffer
}

if (!globalThis.process) {
  // @ts-expect-error - if process is not defined, we need to set it to an empty object
  globalThis.process = {}
}

globalThis.Buffer = QuickCryptoBuffer
globalThis.process.cwd = () => 'sxsx'
globalThis.process.env = { NODE_ENV: 'production' }

installQuickCrypto()
