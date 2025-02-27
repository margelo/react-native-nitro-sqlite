import { transaction } from './operations/transaction'
import { HybridNitroSQLite, init } from './nitro'
import { open } from './operations/session'
import { execute, executeAsync } from './operations/execute'
import { SQLiteNullValue } from './types'
export type * from './types'
export { typeORMDriver } from './typeORM'

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
}

export { open } from './operations/session'

let ENABLE_SIMPLE_NULL_HANDLING = false
export function enableSimpleNullHandling(
  shouldEnableSimpleNullHandling = true
) {
  ENABLE_SIMPLE_NULL_HANDLING = shouldEnableSimpleNullHandling
}
export function isSimpleNullHandlingEnabled() {
  return ENABLE_SIMPLE_NULL_HANDLING
}

export const NITRO_SQLITE_NULL: SQLiteNullValue = { isNitroSQLiteNull: true }
export function isNitroSQLiteNull(value: any): value is SQLiteNullValue {
  if (typeof value === 'object' && 'isNitroSQLiteNull' in value) {
    return true
  }
  return false
}
