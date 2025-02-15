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
 * @interface NativeQueryResult
 */
export interface NativeQueryResult
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly rowsAffected: number
  readonly insertId?: number

  /** Query results */
  readonly results: NativeSQLiteQueryResults
  /** Table metadata */
  readonly metadata?: Record<string, SQLiteQueryColumnMetadata>
}

/**
 * Table metadata
 * Describes some information about the table and it's columns fetched by the query
 * The index is the name of the column
 */
// TODO: Investigate why this doesn't work with nitrogen
// export type SQLiteQueryResultRow = Record<string, SQLiteValue>
// export type SQLiteQueryResults = SQLiteQueryResultRow[]
export type NativeSQLiteQueryResults = Record<string, SQLiteValue>[]

// TODO: Investigate why this doesn't work with nitrogen
// export type SQLiteQueryTableMetadata = Record<string, SQLiteQueryColumnMetadata>
export interface SQLiteQueryColumnMetadata {
  /** The name used for this column for this result set */
  name: string
  /** The declared column type for this column, when fetched directly from a table or a View resulting from a table column. "UNKNOWN" for dynamic values, like function returned ones. */
  type: ColumnType
  /** The index for this column for this result set */
  index: number
}
