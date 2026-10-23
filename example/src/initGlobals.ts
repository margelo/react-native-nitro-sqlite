import { Buffer } from 'buffer'

if (!globalThis.process) {
  // @ts-expect-error - if process is not defined, we need to set it to an empty object
  globalThis.process = {}
}

globalThis.Buffer = Buffer
globalThis.process.cwd = () => 'sxsx'
globalThis.process.env = { NODE_ENV: 'production' }
