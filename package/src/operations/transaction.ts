import { queueOperationAsync, throwIfDatabaseIsNotOpen } from '../DatabaseQueue'
import type {
  QueryResult,
  Transaction,
  SQLiteQueryParams,
  QueryResultRow,
} from '../types'
import { execute, executeAsync } from './execute'
import NitroSQLiteError from '../NitroSQLiteError'

export const transaction = async <Result = void>(
  dbName: string,
  transactionCallback: (tx: Transaction) => Promise<Result>,
  isExclusive = false,
) => {
  throwIfDatabaseIsNotOpen(dbName)

  let isFinished = false

  const executeOnTransaction = <Row extends QueryResultRow = never>(
    query: string,
    params?: SQLiteQueryParams,
  ): QueryResult<Row> => {
    if (isFinished) {
      throw new NitroSQLiteError(
        `Cannot execute query on finalized transaction: ${dbName}`,
      )
    }
    return execute(dbName, query, params)
  }

  const executeAsyncOnTransaction = <Row extends QueryResultRow = never>(
    query: string,
    params?: SQLiteQueryParams,
  ): Promise<QueryResult<Row>> => {
    if (isFinished) {
      throw new NitroSQLiteError(
        `Cannot execute query on finalized transaction: ${dbName}`,
      )
    }
    return executeAsync(dbName, query, params)
  }

  const commit = () => {
    if (isFinished) {
      throw new NitroSQLiteError(
        `Cannot execute commit on finalized transaction: ${dbName}`,
      )
    }
    isFinished = true
    return execute(dbName, 'COMMIT')
  }

  const rollback = () => {
    if (isFinished) {
      throw new NitroSQLiteError(
        `Cannot execute rollback on finalized transaction: ${dbName}`,
      )
    }
    isFinished = true
    return execute(dbName, 'ROLLBACK')
  }

  return await queueOperationAsync(dbName, async () => {
    try {
      await executeAsync(
        dbName,
        isExclusive ? 'BEGIN EXCLUSIVE TRANSACTION' : 'BEGIN TRANSACTION',
      )

      const result = await transactionCallback({
        commit,
        execute: executeOnTransaction,
        executeAsync: executeAsyncOnTransaction,
        rollback,
      })

      if (!isFinished) commit()

      return result
    } catch (executionError) {
      if (!isFinished) {
        try {
          rollback()
        } catch (rollbackError) {
          throw NitroSQLiteError.fromError(rollbackError)
        }
      }

      throw NitroSQLiteError.fromError(executionError)
    }
  })
}
