import type { NitroSQLiteConnection } from '../types'

/**
 * Connection returned by the Node mock's `open()` factory.
 * Supports the corresponding managed connection methods and their queue and
 * transaction lifecycle. Files persist across close/reopen until deletion or
 * reset. Attachments and SQL file imports are not supported.
 * @see {@linkcode NitroSQLiteConnection}
 */
export type MockConnection = Pick<
  NitroSQLiteConnection,
  | 'close'
  | 'delete'
  | 'execute'
  | 'executeAsync'
  | 'executeBatch'
  | 'executeBatchAsync'
  | 'prepare'
  | 'transaction'
>
