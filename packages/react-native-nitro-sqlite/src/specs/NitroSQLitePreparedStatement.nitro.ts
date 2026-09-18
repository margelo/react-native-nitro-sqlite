import type { HybridObject } from 'react-native-nitro-modules'
import type { SQLiteQueryParams } from '../types'
import type { NitroSQLiteQueryResult } from './NitroSQLiteQueryResult.nitro'

export interface NitroSQLitePreparedStatement
  extends HybridObject<{
    ios: 'c++'
    android: 'c++'
  }> {
  readonly isFinalized: boolean

  execute(params?: SQLiteQueryParams): NitroSQLiteQueryResult
  executeAsync(params?: SQLiteQueryParams): Promise<NitroSQLiteQueryResult>
  finalize(): void
}
