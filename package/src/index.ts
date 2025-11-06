import { transaction } from './operations/transaction'
import { HybridNitroSQLite } from './nitro'
import { open } from './operations/session'
import { execute, executeAsync } from './operations/execute'
import { init } from './OnLoad'
import { executeBatch, executeBatchAsync } from './operations/executeBatch'

init()

export const NitroSQLite = {
  ...HybridNitroSQLite,
  native: HybridNitroSQLite,
  // Overwrite native `open` function with session-based JS abstraction,
  // where the database name can be ommited once opened
  open,
  // More JS abstractions, that perform type casting and validation.
  transaction,
  execute,
  executeAsync,
  executeBatch,
  executeBatchAsync,
}

export { open } from './operations/session'
export {
  isNitroSQLiteNull,
  NITRO_SQLITE_NULL,
  isSimpleNullHandlingEnabled,
  enableSimpleNullHandling,
} from './nullHandling'
export { default as NitroSQLiteError } from './NitroSQLiteError'
export type * from './types'
export { typeORMDriver } from './typeORM'
