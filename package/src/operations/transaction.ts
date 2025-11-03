import { HybridNitroSQLite } from '../nitro'
import { queueOperationAsync, throwIfDatabaseIsNotOpen } from '../DatabaseQueue'
import type {
  QueryResult,
  Transaction,
  SQLiteQueryParams,
  QueryResultRow,
} from '../types'
import { execute, executeAsync } from './execute'
import NitroSQLiteError from '../NitroSQLiteError'

export const transaction = (
  dbName: string,
  fn: (tx: Transaction) => Promise<void> | void
): Promise<void> => {
  throwIfDatabaseIsNotOpen(dbName)

  let isFinalized = false

  // Local transaction context object implementation
  const executeOnTransaction = <Data extends QueryResultRow = never>(
    query: string,
    params?: SQLiteQueryParams
  ): QueryResult<Data> => {
    if (isFinalized) {
      throw new NitroSQLiteError(
        `Cannot execute query on finalized transaction: ${dbName}`
      )
    }
    return execute(dbName, query, params)
  }

  const executeAsyncOnTransaction = <Data extends QueryResultRow = never>(
    query: string,
    params?: SQLiteQueryParams
  ): Promise<QueryResult<Data>> => {
    if (isFinalized) {
      throw new NitroSQLiteError(
        `Cannot execute query on finalized transaction: ${dbName}`
      )
    }
    return executeAsync(dbName, query, params)
  }

  const commit = () => {
    if (isFinalized) {
      throw new NitroSQLiteError(
        `Cannot execute commit on finalized transaction: ${dbName}`
      )
    }
    const result = HybridNitroSQLite.execute(dbName, 'COMMIT')
    isFinalized = true
    return result
  }

  const rollback = () => {
    if (isFinalized) {
      throw new NitroSQLiteError(
        `Cannot execute rollback on finalized transaction: ${dbName}`
      )
    }
    const result = HybridNitroSQLite.execute(dbName, 'ROLLBACK')
    isFinalized = true
    return result
  }

  try {
    return queueOperationAsync(dbName, async () => {
      try {
        await HybridNitroSQLite.executeAsync(dbName, 'BEGIN TRANSACTION')

        await fn({
          commit,
          execute: executeOnTransaction,
          executeAsync: executeAsyncOnTransaction,
          rollback,
        })

        if (!isFinalized) commit()
      } catch (executionError) {
        if (!isFinalized) {
          try {
            rollback()
          } catch (rollbackError) {
            throw rollbackError
          }
        }

        throw executionError
      } finally {
        isFinalized = false
      }
    })
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}
