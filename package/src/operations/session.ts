import { locks, HybridNitroSQLite } from '../nitro'
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

export function open(
  options: NitroSQLiteConnectionOptions
): NitroSQLiteConnection {
  openDb(options.name, options.location)

  return {
    close: () => close(options.name),
    delete: () => HybridNitroSQLite.drop(options.name, options.location),
    attach: (dbNameToAttach: string, alias: string, location?: string) =>
      HybridNitroSQLite.attach(options.name, dbNameToAttach, alias, location),
    detach: (alias: string) => HybridNitroSQLite.detach(options.name, alias),
    transaction: (fn: (tx: Transaction) => Promise<void> | void) =>
      transaction(options.name, fn),
    execute: <Row extends QueryResultRow = never>(
      query: string,
      params?: SQLiteQueryParams
    ): QueryResult<Row> => execute(options.name, query, params),
    executeAsync: <Row extends QueryResultRow = never>(
      query: string,
      params?: SQLiteQueryParams
    ): Promise<QueryResult<Row>> => executeAsync(options.name, query, params),
    executeBatch: (commands: BatchQueryCommand[]) =>
      HybridNitroSQLite.executeBatch(options.name, commands),
    executeBatchAsync: (commands: BatchQueryCommand[]) =>
      HybridNitroSQLite.executeBatchAsync(options.name, commands),
    loadFile: (location: string) =>
      HybridNitroSQLite.loadFile(options.name, location),
    loadFileAsync: (location: string) =>
      HybridNitroSQLite.loadFileAsync(options.name, location),
  }
}

export function openDb(dbName: string, location?: string) {
  HybridNitroSQLite.open(dbName, location)

  locks[dbName] = {
    queue: [],
    inProgress: false,
  }
}

export function close(dbName: string) {
  HybridNitroSQLite.close(dbName)
  delete locks[dbName]
}
