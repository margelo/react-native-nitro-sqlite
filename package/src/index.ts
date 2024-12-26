import { transaction } from './operations/transaction'
import { HybridNitroSQLite } from './nitro'
import { open } from './operations/session'
import NitroSQLiteOnLoad from './specs/NativeNitroSQLiteOnLoad'
import { execute, executeAsync } from './operations/execute'

export * from './types'
export { typeORMDriver } from './typeORM'

export const onInitialized = new Promise<void>((resolve) => {
  NitroSQLiteOnLoad.onReactApplicationContextReady(resolve)
})

export const NitroSQLite = {
  ...HybridNitroSQLite,
  native: HybridNitroSQLite,
  onInitialized,
  // Overwrite native `open` function with session-based JS abstraction,
  // where the database name can be ommited once opened
  open,
  // More JS abstractions, that perform type casting and validation.
  transaction,
  execute,
  executeAsync,
}

export { open } from './operations/session'
