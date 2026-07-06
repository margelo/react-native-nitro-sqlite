import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'

/** Optional typed helpers over react-native-nitro-sqlite's execute() for sqlite-vec. */

export type VectorColumnType = 'float' | 'int8' | 'bit'
export type VectorDistanceMetric = 'L2' | 'cosine' | 'L1'

/** A KNN result row: always `rowid` + `distance`, plus any selected columns. */
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
  return row?.value as T
}

/** Returns the linked sqlite-vec version string, e.g. `"v0.1.9"`. */
export function vecVersion(db: NitroSQLiteConnection): string {
  return firstValue<string>(db, 'SELECT vec_version() AS value')
}

/** True if sqlite-vec is linked into the active build (vector flag enabled). */
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

/** Runs a KNN search; `query` is a JSON string `'[0.1,0.2]'` or a numeric array. */
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
