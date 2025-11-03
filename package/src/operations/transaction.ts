import { HybridNitroSQLite } from '../nitro'
import { locks, type QueuedOperation } from '../concurrency'
import type {
  QueryResult,
  Transaction,
  SQLiteQueryParams,
  QueryResultRow,
} from '../types'
import { execute, executeAsync } from './execute'

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
      startNextOperation(dbName)
    }
  }

  return new Promise((resolve, reject) => {
    const queuedTransaction: QueuedOperation = {
      start: () => {
        run().then(resolve).catch(reject)
      },
    }

    locks[dbName]?.queue.push(queuedTransaction)
    startNextOperation(dbName)
  })
}

export function startNextOperation(dbName: string) {
  if (locks[dbName] == null) throw Error(`Lock not found for db: ${dbName}`)

  if (locks[dbName].inProgress) {
    // Operation is already in process bail out
    return
  }

  if (locks[dbName].queue.length > 0) {
    locks[dbName].inProgress = true

    const operation = locks[dbName].queue.shift()!
    setImmediate(() => {
      operation.start()
    })
  }
}
