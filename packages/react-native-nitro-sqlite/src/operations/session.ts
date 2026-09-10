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
  isDatabaseOpen,
  openDatabaseQueue,
  queueOperationAsync,
  startOperationSync,
} from '../DatabaseQueue'

export function open(
  options: NitroSQLiteConnectionOptions,
): NitroSQLiteConnection {
  openDatabaseQueue(options.name)

  try {
    HybridNitroSQLite.open(options.name, options.location)
  } catch (error) {
    closeDatabaseQueue(options.name)
    throw NitroSQLiteError.fromError(error)
  }

  return {
    close: () => {
      try {
        startOperationSync(options.name, () =>
          HybridNitroSQLite.close(options.name),
        )
        closeDatabaseQueue(options.name)
      } catch (error) {
        throw NitroSQLiteError.fromError(error)
      }
    },
    delete: () => {
      try {
        if (!isDatabaseOpen(options.name)) {
          HybridNitroSQLite.drop(options.name, options.location)
          return
        }

        startOperationSync(options.name, () =>
          HybridNitroSQLite.drop(options.name, options.location),
        )
        closeDatabaseQueue(options.name)
      } catch (error) {
        throw NitroSQLiteError.fromError(error)
      }
    },
    attach: (dbNameToAttach: string, alias: string, location?: string) =>
      runSyncOperation(options.name, () =>
        HybridNitroSQLite.attach(options.name, dbNameToAttach, alias, location),
      ),
    detach: (alias: string) =>
      runSyncOperation(options.name, () =>
        HybridNitroSQLite.detach(options.name, alias),
      ),
    transaction: <Result = void>(fn: (tx: Transaction) => Promise<Result>) =>
      transaction(options.name, fn),
    execute: <Row extends QueryResultRow = never>(
      query: string,
      params?: SQLiteQueryParams,
    ): QueryResult<Row> => executeManaged(options.name, query, params),
    executeAsync: <Row extends QueryResultRow = never>(
      query: string,
      params?: SQLiteQueryParams,
    ): Promise<QueryResult<Row>> =>
      executeAsyncManaged(options.name, query, params),
    executeBatch: (commands: BatchQueryCommand[]) =>
      executeBatch(options.name, commands),
    executeBatchAsync: (commands: BatchQueryCommand[]) =>
      executeBatchAsync(options.name, commands),
    loadFile: (location: string) =>
      runSyncOperation(options.name, () =>
        HybridNitroSQLite.loadFile(options.name, location),
      ),
    loadFileAsync: (location: string) =>
      queueOperationAsync(options.name, async () => {
        try {
          return await HybridNitroSQLite.loadFileAsync(options.name, location)
        } catch (error) {
          throw NitroSQLiteError.fromError(error)
        }
      }),
  }
}

function runSyncOperation<Result>(dbName: string, callback: () => Result) {
  try {
    return startOperationSync(dbName, callback)
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}
