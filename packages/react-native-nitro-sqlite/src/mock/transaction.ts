import type BetterSqlite3 from 'better-sqlite3'
import NitroSQLiteError from '../NitroSQLiteError'
import type { QueryResultRow, SQLiteQueryParams, Transaction } from '../types'
import { executeQuery } from './query'

/** @internal Run a callback while the connection's exclusive queue item owns it. */
export async function runTransaction<Result>(
  database: InstanceType<typeof BetterSqlite3>,
  callback: (tx: Transaction) => Promise<Result>,
): Promise<Result> {
  let finished = false
  const pending = new Set<Promise<unknown>>()
  const assertActive = () => {
    if (finished) throw new NitroSQLiteError('Transaction is finalized.')
  }
  const assertSync = () => {
    assertActive()
    if (pending.size > 0) {
      throw new NitroSQLiteError(
        'Await all tx.executeAsync calls before a synchronous transaction operation.',
      )
    }
  }
  const finish = (query: 'COMMIT' | 'ROLLBACK') => {
    assertSync()
    const result = executeQuery(database, query)
    finished = true
    return result
  }
  const tx: Transaction = {
    execute: (query, params) => {
      assertSync()
      return executeQuery(database, query, params)
    },
    executeAsync: async <Row extends QueryResultRow = QueryResultRow>(
      query: string,
      params?: SQLiteQueryParams,
    ) => {
      assertActive()
      const operation = Promise.resolve().then(() =>
        executeQuery<Row>(database, query, params),
      )
      pending.add(operation)
      operation.then(
        () => pending.delete(operation),
        () => pending.delete(operation),
      )
      return operation
    },
    commit: () => finish('COMMIT'),
    rollback: () => finish('ROLLBACK'),
  }

  database.exec('BEGIN TRANSACTION')
  try {
    const result = await callback(tx)
    if (!finished) finish('COMMIT')
    return result
  } catch (error) {
    if (!finished) {
      finished = true
      await Promise.allSettled(pending)
      if (database.inTransaction) database.exec('ROLLBACK')
    }
    throw error
  }
}
