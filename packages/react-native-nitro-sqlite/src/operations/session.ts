import { HybridNitroSQLite } from '../nitro'
import { transaction } from './transaction'
import type {
  BatchQueryCommand,
  NitroSQLiteConnection,
  NitroSQLiteConnectionOptions,
  Transaction,
  SQLiteQueryParams,
  QueryResultRow,
  QueryResult,
} from '../types'
import { executeAsyncManaged, executeManaged } from './execute'
import { executeBatch, executeBatchAsync } from './executeBatch'
import NitroSQLiteError from '../NitroSQLiteError'
import {
  closeDatabaseQueue,
  getDatabaseQueue,
  isDatabaseOpen,
  openDatabaseQueue,
  queueStatementAsync,
  startOperationSync,
} from '../DatabaseQueue'
import type { DatabaseQueueKey } from '../DatabaseQueue'

/** Open or create a database and return a managed connection.
 * Async calls on that connection run in call order. A second managed connection
 * with the same name throws until the first is closed or deleted.
 * @param options Database name and optional directory relative to the platform database directory.
 * @returns A connection bound to the named database.
 */
export function open(
  options: NitroSQLiteConnectionOptions,
): NitroSQLiteConnection {
  const { name, location: databaseLocation, connection, readOnly } = options
  const { connectionId, queueKey } = openNativeConnection(options)
  const connectionQueue = getDatabaseQueue(queueKey)

  const assertCurrentConnection = () => {
    if (
      !isDatabaseOpen(queueKey) ||
      getDatabaseQueue(queueKey) !== connectionQueue
    ) {
      throw new NitroSQLiteError(
        `Database ${name} is not open. There is no connection to the database.`,
      )
    }
  }

  const assertNoReplacement = () => {
    if (
      isDatabaseOpen(queueKey) &&
      getDatabaseQueue(queueKey) !== connectionQueue
    ) {
      throw new NitroSQLiteError(
        `Database ${name} has been reopened with another connection.`,
      )
    }
  }

  const runSyncOperation = <Result>(callback: () => Result): Result => {
    try {
      assertCurrentConnection()
      return startOperationSync(queueKey, callback)
    } catch (error) {
      throw NitroSQLiteError.fromError(error)
    }
  }

  const runOperation = <Result>(callback: () => Result): Result => {
    assertCurrentConnection()
    return callback()
  }

  return {
    close: () => {
      runSyncOperation(() => HybridNitroSQLite.close(connectionId))
      closeDatabaseQueue(queueKey)
    },
    delete: () => {
      if (readOnly) {
        throw new NitroSQLiteError(`Cannot delete read-only database ${name}.`)
      }

      let dropFailed = false
      try {
        assertNoReplacement()
        const drop = () => {
          try {
            if (connection === 'independent') {
              HybridNitroSQLite.drop(name, databaseLocation, connectionId)
            } else {
              HybridNitroSQLite.drop(name, databaseLocation)
            }
          } catch (error) {
            dropFailed = true
            throw error
          }
        }

        if (!isDatabaseOpen(queueKey)) {
          drop()
          return
        }

        startOperationSync(queueKey, drop)
        closeDatabaseQueue(queueKey)
      } catch (error) {
        if (
          dropFailed &&
          isDatabaseOpen(queueKey) &&
          getDatabaseQueue(queueKey) === connectionQueue &&
          !HybridNitroSQLite.isConnectionOpen(connectionId)
        ) {
          closeDatabaseQueue(queueKey)
        }
        throw NitroSQLiteError.fromError(error)
      }
    },
    attach: (dbNameToAttach: string, alias: string, location?: string) =>
      runSyncOperation(() =>
        HybridNitroSQLite.attach(connectionId, dbNameToAttach, alias, location),
      ),
    detach: (alias: string) =>
      runSyncOperation(() => HybridNitroSQLite.detach(connectionId, alias)),
    transaction: async <Result = void>(
      fn: (tx: Transaction) => Promise<Result>,
    ) => runOperation(() => transaction(connectionId, fn, false, queueKey)),
    execute: <Row extends QueryResultRow = never>(
      query: string,
      params?: SQLiteQueryParams,
    ): QueryResult<Row> =>
      runOperation(() => executeManaged(connectionId, query, params, queueKey)),
    executeAsync: async <Row extends QueryResultRow = never>(
      query: string,
      params?: SQLiteQueryParams,
    ): Promise<QueryResult<Row>> =>
      runOperation(() =>
        executeAsyncManaged(connectionId, query, params, queueKey),
      ),
    executeBatch: (commands: BatchQueryCommand[]) =>
      runOperation(() => executeBatch(connectionId, commands, queueKey)),
    executeBatchAsync: async (commands: BatchQueryCommand[]) =>
      runOperation(() => executeBatchAsync(connectionId, commands, queueKey)),
    loadFile: (location: string) =>
      runSyncOperation(() =>
        HybridNitroSQLite.loadFile(connectionId, location),
      ),
    loadFileAsync: (location: string) =>
      runOperation(() =>
        queueStatementAsync(queueKey, async () => {
          try {
            return await HybridNitroSQLite.loadFileAsync(connectionId, location)
          } catch (error) {
            throw NitroSQLiteError.fromError(error)
          }
        }),
      ),
  }
}

function openNativeConnection(options: NitroSQLiteConnectionOptions): {
  connectionId: string
  queueKey: DatabaseQueueKey
} {
  if (options.connection === 'independent') {
    let connectionId: string
    try {
      connectionId = options.readOnly
        ? HybridNitroSQLite.openConnection(options.name, options.location, true)
        : HybridNitroSQLite.openConnection(options.name, options.location)
      const queueKey = Symbol(options.name)
      openDatabaseQueue(queueKey)
      return { connectionId, queueKey }
    } catch (error) {
      throw NitroSQLiteError.fromError(error)
    }
  }

  openDatabaseQueue(options.name)
  try {
    if (options.readOnly) {
      HybridNitroSQLite.open(options.name, options.location, true)
    } else {
      HybridNitroSQLite.open(options.name, options.location)
    }
  } catch (error) {
    closeDatabaseQueue(options.name)
    throw NitroSQLiteError.fromError(error)
  }
  return { connectionId: options.name, queueKey: options.name }
}
