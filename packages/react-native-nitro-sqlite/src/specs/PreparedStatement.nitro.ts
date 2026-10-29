import { Android, iOS, type HybridObject } from 'react-native-nitro-modules'
import type { SQLiteQueryParams } from '../types'
import type { NativeQueryResult } from './NativeQueryResult'

export * from '#nitro/PreparedStatement'

/** Native prepared statement returned by `NitroSQLite.native.prepare()`. */
@iOS({
  language: 'c++',
  implementation: {
    className: 'HybridPreparedStatement',
    include: '"hybridObjects/HybridPreparedStatement.hpp"',
  },
})
@Android({
  language: 'c++',
  implementation: {
    className: 'HybridPreparedStatement',
    include: '"hybridObjects/HybridPreparedStatement.hpp"',
  },
})
export declare class PreparedStatement extends HybridObject {
  /** Whether the native statement has been finalized. */
  readonly isFinalized: boolean

  /** Execute on the calling thread, replacing the previous parameter bindings.
   * Throws after finalization or connection closure.
   * @param params Values bound to positional placeholders.
   * @returns Native query rows, affected row count, insert ID, and metadata.
   */
  execute(params?: SQLiteQueryParams): NativeQueryResult
  /** Execute on a background thread, replacing the previous parameter bindings.
   * Rejects after finalization or connection closure.
   * @param params Values bound to positional placeholders.
   * @returns A promise of the native query result.
   */
  executeAsync(params?: SQLiteQueryParams): Promise<NativeQueryResult>
  /** Release the native statement. Repeated calls are safe. */
  finalize(): void
}
