import { locks, HybridNitroSQLite } from '../nitro'
import type {
  QueryResult,
  Transaction,
  SQLiteQueryParams,
  QueryResultRow,
} from '../types'
import { execute, executeAsync } from './execute'

export interface PendingTransaction {
  /*
   * The start function should not throw or return a promise because the
   * queue just calls it and does not monitor for failures or completions.
   *
   * It should catch any errors and call the resolve or reject of the wrapping
   * promise when complete.
   *
   * It should also automatically commit or rollback the transaction if needed
   */
  start: () => void
}

export const transaction = (
  dbName: string,
  fn: (tx: Transaction) => Promise<void> | void
): Promise<void> => {
  if (locks[dbName] == null)
    throw Error(`Nitro SQLite Error: No lock found on db: ${dbName}`)

  let isFinalized = false

  // Local transaction context object implementation
  const executeOnTransaction = <Data extends QueryResultRow = never>(
    query: string,
    params?: SQLiteQueryParams
  ): QueryResult<Data> => {
    if (isFinalized) {
      throw Error(
        `Nitro SQLite Error: Cannot execute query on finalized transaction: ${dbName}`
      )
    }
    return execute(dbName, query, params)
  }

  const executeAsyncOnTransaction = <Data extends QueryResultRow = never>(
    query: string,
    params?: SQLiteQueryParams
  ): Promise<QueryResult<Data>> => {
    if (isFinalized) {
      throw Error(
        `Nitro SQLite Error: Cannot execute query on finalized transaction: ${dbName}`
      )
    }
    return executeAsync(dbName, query, params)
  }

  const commit = () => {
    if (isFinalized) {
      throw Error(
        `Nitro SQLite Error: Cannot execute commit on finalized transaction: ${dbName}`
      )
    }
    const result = HybridNitroSQLite.execute(dbName, 'COMMIT')
    isFinalized = true
    return result
  }

  const rollback = () => {
    if (isFinalized) {
      throw Error(
        `Nitro SQLite Error: Cannot execute rollback on finalized transaction: ${dbName}`
      )
    }
    const result = HybridNitroSQLite.execute(dbName, 'ROLLBACK')
    isFinalized = true
    return result
  }

  async function run() {
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
      locks[dbName]!.inProgress = false
      isFinalized = false
      startNextTransaction(dbName)
    }
  }

  return new Promise((resolve, reject) => {
    const tx: PendingTransaction = {
      start: () => {
        run().then(resolve).catch(reject)
      },
    }

    locks[dbName]?.queue.push(tx)
    startNextTransaction(dbName)
  })
}

function startNextTransaction(dbName: string) {
  if (locks[dbName] == null) throw Error(`Lock not found for db: ${dbName}`)

  if (locks[dbName].inProgress) {
    // Transaction is already in process bail out
    return
  }

  if (locks[dbName].queue.length > 0) {
    locks[dbName].inProgress = true

    const tx = locks[dbName].queue.shift()!
    setImmediate(() => {
      tx.start()
    })
  }
}
