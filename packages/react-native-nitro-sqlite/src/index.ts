import { transaction } from './operations/transaction'
import { HybridNitroSQLite } from './nitro'
import { open } from './operations/session'
import { execute, executeAsync } from './operations/execute'
import { prepare } from './operations/prepare'
import { executeBatch, executeBatchAsync } from './operations/executeBatch'

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
  prepare,
  executeBatch,
  executeBatchAsync,
}

export { open } from './operations/session'
export {
  SQLiteError,
  SQLiteExceptionType,
  NitroSQLiteError,
  NitroSQLiteExceptionType,
} from './errors'
export type { DatabaseQueueKey } from './DatabaseQueue'
export type { NitroSQLite as NativeSQLite } from './specs/NitroSQLite.nitro'
export type { PreparedStatement as NativePreparedStatement } from './specs/PreparedStatement.nitro'
export type {
  NativeQueryResult,
  NativeQueryRows,
  QueryColumnMetadata,
} from './specs/NativeQueryResult'
export type { TypeOrmConnection } from './typeORM'
export type * from './types'
export type * from './deprecated'
export { typeORMDriver } from './typeORM'
