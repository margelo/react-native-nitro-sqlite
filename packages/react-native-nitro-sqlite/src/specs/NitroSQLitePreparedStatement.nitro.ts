import type { HybridObject } from 'react-native-nitro-modules'
import type { SQLiteQueryParams } from '../types'
import type {
  NitroSQLiteQueryResult,
  NitroSQLiteRawQueryResult,
} from './NitroSQLiteQueryResult.nitro'

/** Native prepared statement returned by `NitroSQLite.native.prepare()`. */
export interface NitroSQLitePreparedStatement
  extends HybridObject<{
    ios: 'c++'
    android: 'c++'
  }> {
  /** Whether the native statement has been finalized. */
  readonly isFinalized: boolean

  /** Execute on the calling thread, replacing the previous parameter bindings.
   * Throws after finalization or connection closure.
   * @param params Values bound to positional placeholders.
   * @returns Native query rows, affected row count, insert ID, and metadata.
   */
  execute(params?: SQLiteQueryParams): NitroSQLiteQueryResult
  /** Execute on a background thread, replacing the previous parameter bindings.
   * Rejects after finalization or connection closure.
   * @param params Values bound to positional placeholders.
   * @returns A promise of the native query result.
   */
  executeAsync(params?: SQLiteQueryParams): Promise<NitroSQLiteQueryResult>
  /** Execute on the calling thread like `execute`, returning rows as arrays of column values.
   * @param params Values bound to positional placeholders.
   * @returns Column names, rows as value arrays, affected row count, and insert ID.
   */
  executeRaw(params?: SQLiteQueryParams): NitroSQLiteRawQueryResult
  /** Execute on a background thread like `executeAsync`, returning rows as arrays of column values.
   * @param params Values bound to positional placeholders.
   * @returns A promise of the native raw query result.
   */
  executeRawAsync(
    params?: SQLiteQueryParams,
  ): Promise<NitroSQLiteRawQueryResult>
  /** Release the native statement. Repeated calls are safe. */
  finalize(): void
}
