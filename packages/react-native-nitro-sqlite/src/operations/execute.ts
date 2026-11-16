import { HybridNitroSQLite } from '../nitro'
import type { QueryResult, QueryResultRow, SQLiteQueryParams } from '../types'
import NitroSQLiteError from '../NitroSQLiteError'
import { callNativeAsync, rejectWithNitroSQLiteError } from '../nativePromise'
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
  if (!hasRowBatchHandler) {
    return executeAsyncWithRowCallback<Row>(dbName, query, params)
  }
  const rowBatchId = nextRowBatchId()
  let nativeResult: Promise<NitroSQLiteQueryResult>
  try {
    nativeResult = HybridNitroSQLite.executeAsync(
      dbName,
      query,
      params,
      undefined,
      rowBatchId,
    )
  } catch (error) {
    return Promise.reject(NitroSQLiteError.fromError(error))
  }
  return nativeResult.then(
    (result) =>
      buildJSQueryResult<Row>(result, takeLeadingRows<Row>(rowBatchId)),
    (error: unknown) => {
      leadingRowBatches.delete(rowBatchId)
      return rejectWithNitroSQLiteError(error)
    },
  )
}

// Leading row batches of async queries in flight, by row batch ID. One handler, set on the first
// query, receives every batch, so a query passes a number to native code instead of a new callback.
const leadingRowBatches = new Map<number, QueryResultRow[]>()
// Older native builds have no handler and get a callback per query instead.
const hasRowBatchHandler =
  typeof HybridNitroSQLite.setRowBatchHandler === 'function'
let lastRowBatchId = 0

function nextRowBatchId(): number {
  if (lastRowBatchId === 0) {
    HybridNitroSQLite.setRowBatchHandler((rowBatchId, rows) => {
      leadingRowBatches.set(
        rowBatchId,
        appendRows(leadingRowBatches.get(rowBatchId), rows),
      )
    })
  }
  lastRowBatchId++
  return lastRowBatchId
}

function takeLeadingRows<Row>(rowBatchId: number): Row[] | undefined {
  const rows = leadingRowBatches.get(rowBatchId)
  if (rows !== undefined) leadingRowBatches.delete(rowBatchId)
  return rows as Row[] | undefined
}

function executeAsyncWithRowCallback<Row extends QueryResultRow>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): Promise<QueryResult<Row>> {
  let leadingRows: Row[] | undefined
  return callNativeAsync(() =>
    HybridNitroSQLite.executeAsync(dbName, query, params, (rows) => {
      leadingRows = appendRows(leadingRows, rows as Row[])
    }),
  ).then((result) => buildJSQueryResult<Row>(result, leadingRows))
}

function appendRows<Row>(leadingRows: Row[] | undefined, rows: Row[]): Row[] {
  if (leadingRows === undefined) return rows
  Array.prototype.push.apply(leadingRows, rows)
  return leadingRows
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
  return callNativeAsync(() =>
    HybridNitroSQLite.executeRawAsync(dbName, query, params),
  )
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
