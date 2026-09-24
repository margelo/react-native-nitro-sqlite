import { queueOperationAsync, throwIfDatabaseIsNotOpen } from '../DatabaseQueue'
import type {
  Transaction,
  SQLiteQueryParams,
  QueryResult,
  QueryResultRow,
} from '../types'
import { executeAsyncNative, executeNative } from './execute'
import NitroSQLiteError from '../NitroSQLiteError'
import type { DatabaseQueueKey } from '../DatabaseQueue'

/** Queue a transaction for an open managed connection.
 * Use only the supplied `tx` for work on this database inside the callback.
 * A successful callback commits unless it explicitly committed or rolled back;
 * a thrown error rolls back unless the transaction was already finalized.
 * @param dbName Name of the open database.
 * @param transactionCallback Async callback receiving the transaction handle.
 * @param isExclusive Begin an exclusive transaction when true.
 * @returns The callback's result after the transaction finishes.
 */
export const transaction = async <Result = void>(
  dbName: string,
  transactionCallback: (tx: Transaction) => Promise<Result>,
  isExclusive = false,
  queueKey: DatabaseQueueKey = dbName,
) => {
  throwIfDatabaseIsNotOpen(queueKey)

  let isFinished = false
  const pendingAsyncStatements = new Set<Promise<unknown>>()

  const throwIfAsyncPending = () => {
    if (pendingAsyncStatements.size > 0) {
      throw new NitroSQLiteError(
        `Cannot run synchronous operation on transaction ${dbName} while async queries are pending. Await all tx.executeAsync calls first.`,
      )
    }
  }

  const executeOnTransaction = <Row extends QueryResultRow = never>(
    query: string,
    params?: SQLiteQueryParams,
  ): QueryResult<Row> => {
    if (isFinished) {
      throw new NitroSQLiteError(
        `Cannot execute query on finalized transaction: ${dbName}`,
      )
    }
    throwIfAsyncPending()
    return executeNative(dbName, query, params)
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
    const pending = executeAsyncNative<Row>(dbName, query, params)
    pendingAsyncStatements.add(pending)
    pending.then(
      () => pendingAsyncStatements.delete(pending),
      () => pendingAsyncStatements.delete(pending),
    )
    return pending
  }

  const commit = () => {
    if (isFinished) {
      throw new NitroSQLiteError(
        `Cannot execute commit on finalized transaction: ${dbName}`,
      )
    }
    throwIfAsyncPending()
    isFinished = true
    return executeNative(dbName, 'COMMIT')
  }

  const rollback = () => {
    if (isFinished) {
      throw new NitroSQLiteError(
        `Cannot execute rollback on finalized transaction: ${dbName}`,
      )
    }
    throwIfAsyncPending()
    isFinished = true
    return executeNative(dbName, 'ROLLBACK')
  }

  return await queueOperationAsync(queueKey, async () => {
    try {
      await executeAsyncNative(
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
        isFinished = true
        // All queued native calls must finish before ROLLBACK can run
        // synchronously on this connection.
        await Promise.allSettled(pendingAsyncStatements)
        try {
          executeNative(dbName, 'ROLLBACK')
        } catch (rollbackError) {
          throw NitroSQLiteError.fromError(rollbackError)
        }
      }

      throw NitroSQLiteError.fromError(executionError)
    }
  })
}
