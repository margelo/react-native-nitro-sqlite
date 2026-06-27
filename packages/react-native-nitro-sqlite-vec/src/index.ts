import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'

/**
 * react-native-nitro-sqlite-vec
 *
 * sqlite-vec is statically linked into react-native-nitro-sqlite's single
 * sqlite3 build, so vector search works directly through the core's
 * `execute()` API (vec0 virtual tables + `vec_*` SQL functions). This module
 * adds optional, thin, typed helpers on top — it does not introduce a new way
 * to run queries.
 */

export type VectorColumnType = 'float' | 'int8' | 'bit'
export type VectorDistanceMetric = 'L2' | 'cosine' | 'L1'

/** A single KNN result row. Always includes `rowid` and `distance`; any
 * additional selected columns appear by name. */
export interface KnnMatch {
  rowid: number
  distance: number
  [column: string]: unknown
}

export interface CreateVectorTableOptions {
  /** Number of dimensions of the vector column. */
  dimensions: number
  /** Vector storage type. Defaults to `'float'` (float32). */
  type?: VectorColumnType
  /** Distance metric. Defaults to sqlite-vec's default (L2). */
  distanceMetric?: VectorDistanceMetric
  /** Vector column name. Defaults to `'embedding'`. */
  column?: string
}

export interface KnnSearchOptions {
  /** Vector column name. Defaults to `'embedding'`. */
  column?: string
}

function firstValue<T>(db: NitroSQLiteConnection, sql: string): T {
  const row = db.execute(sql).rows?._array?.[0]
  return (row?.value as T)
}

/** Returns the linked sqlite-vec version string, e.g. `"v0.1.9"`. */
export function vecVersion(db: NitroSQLiteConnection): string {
  return firstValue<string>(db, 'SELECT vec_version() AS value')
}

/**
 * True if sqlite-vec is statically linked into the active sqlite3 build
 * (i.e. react-native-nitro-sqlite was built with the vector flag enabled).
 */
export function isVecAvailable(db: NitroSQLiteConnection): boolean {
  try {
    vecVersion(db)
    return true
  } catch {
    return false
  }
}

/** Creates a `vec0` virtual table for the given vector column. */
export function createVectorTable(
  db: NitroSQLiteConnection,
  table: string,
  options: CreateVectorTableOptions,
): void {
  const column = options.column ?? 'embedding'
  const type = options.type ?? 'float'
  const metric = options.distanceMetric
  const metricClause = metric ? ` distance_metric=${metric}` : ''
  db.execute(
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${table} USING vec0(${column} ${type}[${options.dimensions}]${metricClause});`,
  )
}

/**
 * Runs a K-nearest-neighbours search. `query` may be a JSON string
 * (`'[0.1, 0.2]'`) or a numeric array (`[0.1, 0.2]`).
 */
export function knnSearch(
  db: NitroSQLiteConnection,
  table: string,
  query: string | number[],
  k: number,
  options?: KnnSearchOptions,
): KnnMatch[] {
  const column = options?.column ?? 'embedding'
  const vector = typeof query === 'string' ? query : JSON.stringify(query)
  const result = db.execute(
    `SELECT rowid, distance FROM ${table} WHERE ${column} MATCH ? AND k = ? ORDER BY distance`,
    [vector, k],
  )
  return (result.rows?._array ?? []) as unknown as KnnMatch[]
}
