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
 * Failed commits trigger rollback and rejection unless the callback explicitly rolls back.
 * If rollback also fails, the error cause is an AggregateError with both failures.
 * @param dbName Name of the open database.
 * @param transactionCallback Async callback receiving the transaction handle.
 * @param isExclusive Begin an exclusive transaction when true.
 * @param queueKey Managed connection queue identifier; defaults to the database name.
 * @returns The callback's result after the transaction finishes.
 * @throws NitroSQLiteError if BEGIN, the callback, COMMIT, or ROLLBACK fails.
 */
export const transaction = async <Result = void>(
  dbName: string,
  transactionCallback: (tx: Transaction) => Promise<Result>,
  isExclusive = false,
  queueKey: DatabaseQueueKey = dbName,
) => {
  throwIfDatabaseIsNotOpen(queueKey)

  const state: { current: TransactionState } = {
    current: { kind: 'notStarted' },
  }
  const getState = (): TransactionState => state.current
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
    if (state.current.kind !== 'active') {
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
    if (state.current.kind !== 'active') {
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
    if (state.current.kind !== 'active') {
      throw new NitroSQLiteError(
        `Cannot execute commit on finalized transaction: ${dbName}`,
      )
    }
    throwIfAsyncPending()
    try {
      const result = executeNative(dbName, 'COMMIT')
      state.current = { kind: 'committed' }
      return result
    } catch (error) {
      state.current = { kind: 'commitFailed', error }
      throw error
    }
  }

  const rollback = () => {
    if (
      state.current.kind !== 'active' &&
      state.current.kind !== 'commitFailed'
    ) {
      throw new NitroSQLiteError(
        `Cannot execute rollback on finalized transaction: ${dbName}`,
      )
    }
    throwIfAsyncPending()
    const previousState = getState()
    try {
      const result = executeNative(dbName, 'ROLLBACK')
      state.current = { kind: 'rolledBack' }
      return result
    } catch (error) {
      const failure =
        previousState.kind === 'commitFailed'
          ? transactionFinalizationError(previousState.error, error)
          : error
      state.current = { kind: 'rollbackFailed', error: failure }
      throw failure
    }
  }

  return await queueOperationAsync(queueKey, async () => {
    try {
      await executeAsyncNative(
        dbName,
        isExclusive ? 'BEGIN EXCLUSIVE TRANSACTION' : 'BEGIN TRANSACTION',
      )

      state.current = { kind: 'active' }

      const result = await transactionCallback({
        commit,
        execute: executeOnTransaction,
        executeAsync: executeAsyncOnTransaction,
        rollback,
      })

      const callbackState = getState()
      if (
        callbackState.kind === 'commitFailed' ||
        callbackState.kind === 'rollbackFailed'
      ) {
        throw callbackState.error
      }
      if (state.current.kind === 'active') commit()

      return result
    } catch (executionError) {
      if (
        state.current.kind === 'active' ||
        state.current.kind === 'commitFailed'
      ) {
        state.current = { kind: 'rollingBack' }
        // All queued native calls must finish before ROLLBACK can run
        // synchronously on this connection.
        await Promise.allSettled(pendingAsyncStatements)
        try {
          executeNative(dbName, 'ROLLBACK')
          state.current = { kind: 'rolledBack' }
        } catch (rollbackError) {
          state.current = { kind: 'rollbackFailed', error: rollbackError }
          throw transactionFinalizationError(executionError, rollbackError)
        }
      }

      throw NitroSQLiteError.fromError(executionError)
    }
  })
}

type TransactionState =
  | {
      kind: 'notStarted' | 'active' | 'committed' | 'rolledBack' | 'rollingBack'
    }
  | { kind: 'commitFailed' | 'rollbackFailed'; error: unknown }

function transactionFinalizationError(
  primary: unknown,
  rollback: unknown,
): NitroSQLiteError {
  const primaryError = NitroSQLiteError.fromError(primary)
  const rollbackError = NitroSQLiteError.fromError(rollback)
  return new NitroSQLiteError(
    `${primaryError.message}\nRollback failed: ${rollbackError.message}`,
    {
      cause: new AggregateError(
        [primaryError, rollbackError],
        'Transaction finalization failed',
      ),
    },
  )
}
