import type { CustomType } from 'react-native-nitro-modules'
import type { ColumnType, SQLiteValue } from '../types'

/** Result rows keyed by column name. Native rows become JavaScript objects on the JavaScript thread. */
export type NativeQueryRows = CustomType<
  Record<string, SQLiteValue>[],
  'margelo::nitro::rnnitrosqlite::SQLiteQueryResults',
  { include: 'SQLiteQueryResults.hpp' }
>

/** Native result of one SQL statement, delivered as a plain JavaScript object.
 * The managed API also adds a `rows` adapter.
 */
export interface NativeQueryResult {
  /** SQLite's latest row change count. For a read-only query it may reflect an earlier write. */
  readonly rowsAffected: number
  /** Last insert row ID for this connection. It may refer to an earlier statement. */
  readonly insertId?: number

  /** Rows keyed by result column names. */
  readonly results: NativeQueryRows

  /** Column metadata keyed by result column name, when available. */
  readonly metadata?: Record<string, QueryColumnMetadata>

  /** Number of row batches sent through the native `onRows` callback, or zero when none were sent.
   * Callbacks may arrive after the native promise resolves. Wait for this many batches before
   * combining them with `results`. The managed async API waits for them automatically.
   * An omitted count is treated as zero. Batch tracking requires an updated native build.
   */
  readonly rowBatchCount?: number
}

// TODO: Investigate why this cannot be represented in Nitro
// export type NitroQueryResultRow = {
//   [key: string]: SQLiteValue
// }

// type NitroQueryResultRow = Record<string, SQLiteValue>

/** Name, declared type, and position of a result column. */
export type QueryColumnMetadata = {
  /** Name used for this column in the result set. */
  name: string

  /** Native type category derived from the column declaration. */
  type: ColumnType

  /** Zero-based position in the result set. */
  index: number
}
