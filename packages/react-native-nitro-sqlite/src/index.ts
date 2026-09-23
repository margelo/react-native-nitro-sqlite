import { transaction } from './operations/transaction'
import { HybridNitroSQLite } from './nitro'
import { open } from './operations/session'
import { execute, executeAsync } from './operations/execute'
import { init } from './OnLoad'
import { executeBatch, executeBatchAsync } from './operations/executeBatch'

init()

/** Database entry point. Prefer {@link open} for a managed connection.
 * `native` exposes the Nitro object directly and bypasses the JavaScript queue.
 */
export const NitroSQLite = {
  ...HybridNitroSQLite,
  native: HybridNitroSQLite,
  // The managed open method returns a connection bound to its database name.
  open,
  // Managed query methods add typed rows and normalize errors.
  transaction,
  execute,
  executeAsync,
  executeBatch,
  executeBatchAsync,
}

export { open } from './operations/session'
export { default as NitroSQLiteError } from './NitroSQLiteError'
export type * from './types'
export { typeORMDriver } from './typeORM'
