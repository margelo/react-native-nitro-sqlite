import { HybridNitroSQLite } from '../nitro'
import { transaction } from './transaction'
import type {
  BatchQueryCommand,
  NitroSQLiteConnection,
  NitroSQLiteConnectionOptions,
  QueryResult,
  Transaction,
  SQLiteQueryParams,
  QueryResultRow,
} from '../types'
import { execute, executeAsync } from './execute'
import { executeBatch, executeBatchAsync } from './executeBatch'
import NitroSQLiteError from '../NitroSQLiteError'
import { closeDatabaseQueue, openDatabaseQueue } from '../DatabaseQueue'

export function open(
  options: NitroSQLiteConnectionOptions,
): NitroSQLiteConnection {
  try {
    HybridNitroSQLite.open(options.name, options.location)
    openDatabaseQueue(options.name)
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }

  return {
    close: () => {
      try {
        HybridNitroSQLite.close(options.name)
        closeDatabaseQueue(options.name)
      } catch (error) {
        throw NitroSQLiteError.fromError(error)
      }
    },
    delete: () => HybridNitroSQLite.drop(options.name, options.location),
    attach: (dbNameToAttach: string, alias: string, location?: string) =>
      HybridNitroSQLite.attach(options.name, dbNameToAttach, alias, location),
    detach: (alias: string) => HybridNitroSQLite.detach(options.name, alias),
    transaction: <Result = void>(fn: (tx: Transaction) => Promise<Result>) =>
      transaction(options.name, fn),
    execute: <Row extends QueryResultRow = never>(
      query: string,
      params?: SQLiteQueryParams,
    ): QueryResult<Row> => execute(options.name, query, params),
    executeAsync: <Row extends QueryResultRow = never>(
      query: string,
      params?: SQLiteQueryParams,
    ): Promise<QueryResult<Row>> => executeAsync(options.name, query, params),
    executeBatch: (commands: BatchQueryCommand[]) =>
      executeBatch(options.name, commands),
    executeBatchAsync: (commands: BatchQueryCommand[]) =>
      executeBatchAsync(options.name, commands),
    loadFile: (location: string) =>
      HybridNitroSQLite.loadFile(options.name, location),
    loadFileAsync: (location: string) =>
      HybridNitroSQLite.loadFileAsync(options.name, location),
    loadExtension: (path: string, entryPoint?: string) =>
      HybridNitroSQLite.loadExtension(options.name, path, entryPoint),
  }
}
