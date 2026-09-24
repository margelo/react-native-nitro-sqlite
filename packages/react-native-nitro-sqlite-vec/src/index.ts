import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'

/** Vector storage types accepted by a `vec0` column. */
export type VectorColumnType = 'float' | 'int8' | 'bit'

/** Distance metrics accepted by a `vec0` column. */
export type VectorDistanceMetric = 'L2' | 'cosine' | 'L1'

/** One nearest-neighbor match returned by {@link knnSearch}. */
export interface KnnMatch {
  /** SQLite row ID of the matching vector. */
  rowid: number
  /** Distance from the query vector, ordered from smallest to largest. */
  distance: number
  /** Allows additional columns when using this row shape with custom queries. */
  [column: string]: unknown
}

/** Settings for a `vec0` virtual table created by {@link createVectorTable}. */
export interface CreateVectorTableOptions {
  /** Number of dimensions passed to `vec0` for the vector column. */
  dimensions: number
  /** Vector storage type. Defaults to `'float'` (float32). */
  type?: VectorColumnType
  /** Distance metric. Omit to use sqlite-vec's default (L2). */
  distanceMetric?: VectorDistanceMetric
  /** Trusted SQL column identifier. Defaults to `'embedding'`. */
  column?: string
}

/** Settings for {@link knnSearch}. */
export interface KnnSearchOptions {
  /** Trusted SQL column identifier. Defaults to `'embedding'`. */
  column?: string
}

function firstValue<T>(db: NitroSQLiteConnection, sql: string): T {
  const row = db.execute(sql).rows?._array?.[0]
  return row?.value as T
}

/** Query the sqlite-vec version on an open connection.
 * @param db Open NitroSQLite connection. The query runs synchronously.
 * @returns The linked version string, for example `"v0.1.9"`.
 * @throws If `vec_version()` is unavailable or the query fails.
 */
export function vecVersion(db: NitroSQLiteConnection): string {
  return firstValue<string>(db, 'SELECT vec_version() AS value')
}

/** Check whether the version query succeeds on this connection.
 * @param db Open NitroSQLite connection. The check runs synchronously.
 * @returns `false` if the version query throws for any reason, including a closed connection.
 */
export function isVecAvailable(db: NitroSQLiteConnection): boolean {
  try {
    vecVersion(db)
    return true
  } catch {
    return false
  }
}

/** Create a `vec0` virtual table if it does not already exist.
 * Executes synchronously. An existing table is left as it is, even if its
 * definition differs from `options`.
 * @param db Open NitroSQLite connection with sqlite-vec enabled.
 * @param table Trusted SQL table identifier, interpolated into the statement.
 * @param options Vector dimensions, storage type, metric, and trusted column identifier.
 */
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

/** Search a `vec0` table for the nearest vectors.
 * Executes synchronously and returns matches ordered by increasing distance.
 * @param db Open NitroSQLite connection with sqlite-vec enabled.
 * @param table Trusted SQL table identifier, interpolated into the statement.
 * @param query JSON vector string passed through unchanged, or a numeric array serialized as JSON.
 * @param k Maximum number of matches requested.
 * @param options Optional trusted vector column identifier.
 * @returns Matching row IDs and distances, or an empty array when no rows are returned.
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
