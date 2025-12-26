import type { HybridObject } from 'react-native-nitro-modules'
import type { ColumnType, SQLiteValue } from '../types'

/**
 * Object returned by SQL Query executions {
 *  insertId: Represent the auto-generated row id if applicable
 *  rowsAffected: Number of affected rows if result of a update query
 *  message: if status === 1, here you will find error description
 *  rows: if status is undefined or 0 this object will contain the query results
 * }
 *
 * @interface QueryResult
 */
export interface NitroSQLiteQueryResult
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly rowsAffected: number
  readonly insertId?: number

  /** Query results */
  readonly results: Record<string, SQLiteValue>[]

  /** Query results in a row format for TypeORM compatibility */
  readonly rows?: NitroSQLiteQueryResultRows

  /** Table metadata */
  readonly metadata?: Record<string, NitroSQLiteQueryColumnMetadata>
}

// TODO: Investigate why this cannot be represented in Nitro

// type NitroQueryResultRow = Record<string, SQLiteValue>

export type NitroSQLiteQueryResultRows<
  Row extends Record<string, SQLiteValue> = Record<string, SQLiteValue>,
> = {
  /** Raw array with all dataset */
  _array: Row[]
  /** The lengh of the dataset */
  length: number
  /** A convenience function to acess the index based the row object
   * @param idx the row index
   * @returns the row structure identified by column names
   */
  item: (idx: number) => Record<string, SQLiteValue> | undefined
}

export type NitroSQLiteQueryColumnMetadata = {
  /** The name used for this column for this result set */
  name: string

  /** The declared column type for this column, when fetched directly from a table or a View resulting from a table column. "UNKNOWN" for dynamic values, like function returned ones. */
  type: ColumnType

  /** The index for this column for this result set */
  index: number
}
