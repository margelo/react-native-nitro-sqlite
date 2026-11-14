import { HybridNitroSQLite } from '../nitro'
import type { QueryResult, QueryResultRow, SQLiteQueryParams } from '../types'
import NitroSQLiteError from '../NitroSQLiteError'
import type {
  NitroSQLiteQueryResult,
  NitroSQLiteRawQueryResult,
} from '../specs/NitroSQLiteQueryResult.nitro'
import {
  isDatabaseOpen,
  queueStatementAsync,
  startOperationSync,
} from '../DatabaseQueue'
import type { DatabaseQueueKey } from '../DatabaseQueue'

/** Execute one SQL statement synchronously by database name.
 * Uses the managed queue when the database has an open managed connection.
 * @param dbName Name of an open native database.
 * @param query SQL statement with optional positional placeholders.
 * @param params Values bound to the placeholders.
 * @returns The query result with typed rows.
 */
export function execute<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): QueryResult<Row> {
  if (!isDatabaseOpen(dbName)) {
    return executeNative(dbName, query, params)
  }

  return executeManaged(dbName, query, params)
}

export function executeManaged<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
  queueKey: DatabaseQueueKey = dbName,
): QueryResult<Row> {
  return startOperationSync(queueKey, () =>
    executeNative(dbName, query, params),
  )
}

export function executeNative<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): QueryResult<Row> {
  try {
    const nativeResult = HybridNitroSQLite.execute(dbName, query, params)
    return buildJSQueryResult<Row>(nativeResult)
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}

/** Execute one SQL statement asynchronously by database name.
 * Uses the managed queue when the database has an open managed connection.
 * @param dbName Name of an open native database.
 * @param query SQL statement with optional positional placeholders.
 * @param params Values bound to the placeholders.
 * @returns A promise of the query result with typed rows.
 */
export function executeAsync<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): Promise<QueryResult<Row>> {
  if (!isDatabaseOpen(dbName)) {
    return executeAsyncNative(dbName, query, params)
  }

  return executeAsyncManaged(dbName, query, params)
}

export function executeAsyncManaged<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
  queueKey: DatabaseQueueKey = dbName,
): Promise<QueryResult<Row>> {
  return queueStatementAsync(queueKey, () =>
    executeAsyncNative<Row>(dbName, query, params),
  )
}

export function executeAsyncNative<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): Promise<QueryResult<Row>> {
  // Not `async`: every extra promise layer is a measurable part of a short query's cost.
  // Large results arrive in batches, so rows are converted while SQLite reads the rest.
  let leadingRows: Row[] | undefined
  let nativeResult: Promise<NitroSQLiteQueryResult>
  try {
    nativeResult = HybridNitroSQLite.executeAsync(
      dbName,
      query,
      params,
      (rows) => {
        if (leadingRows === undefined) {
          leadingRows = rows as Row[]
        } else {
          Array.prototype.push.apply(leadingRows, rows as Row[])
        }
      },
    )
  } catch (error) {
    return Promise.reject(NitroSQLiteError.fromError(error))
  }
  return nativeResult.then(
    (result) => buildJSQueryResult<Row>(result, leadingRows),
    rejectWithNitroSQLiteError,
  )
}

/** Execute one SQL statement synchronously by database name, returning rows as arrays.
 * Uses the default managed connection's queue when the database was opened through `open()`.
 * Otherwise, calls the open native database directly.
 * @param dbName Name of an open database.
 * @param query SQL statement with optional positional placeholders.
 * @param params Values bound to the placeholders.
 * @returns Rows and column names in SQL column order, with affected row count and insert ID.
 * @throws NitroSQLiteError if the managed connection is busy or the query fails.
 */
export function executeRaw(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): NitroSQLiteRawQueryResult {
  if (!isDatabaseOpen(dbName)) {
    return executeRawNative(dbName, query, params)
  }

  return executeRawManaged(dbName, query, params)
}

export function executeRawManaged(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
  queueKey: DatabaseQueueKey = dbName,
): NitroSQLiteRawQueryResult {
  return startOperationSync(queueKey, () =>
    executeRawNative(dbName, query, params),
  )
}

export function executeRawNative(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): NitroSQLiteRawQueryResult {
  try {
    return HybridNitroSQLite.executeRaw(dbName, query, params)
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}

/** Execute one SQL statement asynchronously by database name, returning rows as arrays.
 * Uses the default managed connection's queue when the database was opened through `open()`.
 * Otherwise, calls the open native database directly.
 * @param dbName Name of an open database.
 * @param query SQL statement with optional positional placeholders.
 * @param params Values bound to the placeholders.
 * @returns A promise of rows and column names in SQL column order, with affected row count and insert ID.
 * @throws NitroSQLiteError as a rejected promise if the query fails.
 */
export function executeRawAsync(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): Promise<NitroSQLiteRawQueryResult> {
  if (!isDatabaseOpen(dbName)) {
    return executeRawAsyncNative(dbName, query, params)
  }

  return executeRawAsyncManaged(dbName, query, params)
}

export function executeRawAsyncManaged(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
  queueKey: DatabaseQueueKey = dbName,
): Promise<NitroSQLiteRawQueryResult> {
  return queueStatementAsync(queueKey, () =>
    executeRawAsyncNative(dbName, query, params),
  )
}

export function executeRawAsyncNative(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): Promise<NitroSQLiteRawQueryResult> {
  let nativeResult: Promise<NitroSQLiteRawQueryResult>
  try {
    nativeResult = HybridNitroSQLite.executeRawAsync(dbName, query, params)
  } catch (error) {
    return Promise.reject(NitroSQLiteError.fromError(error))
  }
  return nativeResult.catch(rejectWithNitroSQLiteError)
}

/** Rethrows any error as a NitroSQLiteError, for use as a promise rejection handler. */
export function rejectWithNitroSQLiteError(error: unknown): never {
  throw NitroSQLiteError.fromError(error)
}

export function buildJSQueryResult<Row extends QueryResultRow = never>(
  result: NitroSQLiteQueryResult,
  leadingRows?: Row[],
): QueryResult<Row> {
  const resultWithRows = result as QueryResult<Row> & { results: Row[] }
  if (leadingRows !== undefined) {
    Array.prototype.push.apply(leadingRows, result.results as Row[])
    resultWithRows.results = leadingRows
  }
  const results = resultWithRows.results

  resultWithRows.rows = {
    _array: results,
    length: results.length,
    item: (idx: number) => results[idx],
  }

  return resultWithRows
}
