import { queueOperationAsync, throwIfDatabaseIsNotOpen } from '../DatabaseQueue'
import type {
  Transaction,
  SQLiteQueryParams,
  QueryResult,
  QueryResultRow,
} from '../types'
import { execute, executeAsync } from './execute'
import NitroSQLiteError from '../NitroSQLiteError'

type TransactionState =
  | 'active'
  | 'committed'
  | 'rolledBack'
  | 'commitFinalizationFailed'
  | 'rollbackFailed'

export const transaction = async <Result = void>(
  dbName: string,
  transactionCallback: (tx: Transaction) => Promise<Result>,
  isExclusive = false,
) => {
  throwIfDatabaseIsNotOpen(dbName)

  let state: TransactionState = 'active'

  const executeOnTransaction = <Row extends QueryResultRow = never>(
    query: string,
    params?: SQLiteQueryParams,
  ): QueryResult<Row> => {
    if (state !== 'active') {
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
    if (state !== 'active') {
      throw new NitroSQLiteError(
        `Cannot execute query on finalized transaction: ${dbName}`,
      )
    }
    return executeAsync(dbName, query, params)
  }

  const commit = () => {
    if (state !== 'active') {
      throw new NitroSQLiteError(
        `Cannot execute commit on finalized transaction: ${dbName}`,
      )
    }
    try {
      const result = execute(dbName, 'COMMIT')
      state = 'committed'
      return result
    } catch (error) {
      state = 'commitFinalizationFailed'
      throw error
    }
  }

  const rollback = () => {
    if (state !== 'active' && state !== 'commitFinalizationFailed') {
      throw new NitroSQLiteError(
        `Cannot execute rollback on finalized transaction: ${dbName}`,
      )
    }
    try {
      const result = execute(dbName, 'ROLLBACK')
      state = 'rolledBack'
      return result
    } catch (error) {
      state = 'rollbackFailed'
      throw error
    }
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

      if (state === 'active') commit()

      return result
    } catch (executionError) {
      if (state === 'active' || state === 'commitFinalizationFailed') {
        try {
          rollback()
        } catch (rollbackError) {
          const primaryError = NitroSQLiteError.fromError(executionError)
          const finalizationError = NitroSQLiteError.fromError(rollbackError)
          throw new NitroSQLiteError(
            `${primaryError.message}\nRollback failed: ${finalizationError.message}`,
            {
              cause: new AggregateError(
                [primaryError, finalizationError],
                'Transaction finalization failed',
              ),
            },
          )
        }
      }

      throw NitroSQLiteError.fromError(executionError)
    }
  })
}
