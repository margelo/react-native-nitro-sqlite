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
import { executeBatch, executeBatchAsync } from './executeBatch'
import NitroSQLiteError from '../NitroSQLiteError'

export function open(
  options: NitroSQLiteConnectionOptions,
): NitroSQLiteConnection {
  try {
    HybridNitroSQLite.open(options.name, options.location)
    locks[options.name] = {
      queue: [],
      inProgress: false,
    }
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }

  return {
    close: () => {
      try {
        HybridNitroSQLite.close(options.name)
        delete locks[options.name]
      } catch (error) {
        throw NitroSQLiteError.fromError(error)
      }
    },
    delete: () => HybridNitroSQLite.drop(options.name, options.location),
    attach: (dbNameToAttach: string, alias: string, location?: string) =>
      HybridNitroSQLite.attach(options.name, dbNameToAttach, alias, location),
    detach: (alias: string) => HybridNitroSQLite.detach(options.name, alias),
    transaction: (fn: (tx: Transaction) => Promise<void> | void) =>
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
  }
}
