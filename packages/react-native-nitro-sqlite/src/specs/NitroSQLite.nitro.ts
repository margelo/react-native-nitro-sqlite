import type { HybridObject } from 'react-native-nitro-modules'
import type {
  BatchQueryCommand,
  BatchQueryResult,
  FileLoadResult,
  SQLiteQueryParams,
} from '../types'
import type { NitroSQLiteQueryResult } from './NitroSQLiteQueryResult.nitro'

export interface NitroSQLite
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  open(dbName: string, location?: string): void
  close(dbName: string): void
  drop(dbName: string, location?: string): void
  attach(
    mainDbName: string,
    dbNameToAttach: string,
    alias: string,
    location?: string,
  ): void
  detach(mainDbName: string, alias: string): void
  execute(
    dbName: string,
    query: string,
    params?: SQLiteQueryParams,
  ): NitroSQLiteQueryResult
  executeAsync(
    dbName: string,
    query: string,
    params?: SQLiteQueryParams,
  ): Promise<NitroSQLiteQueryResult>
  executeBatch(dbName: string, commands: BatchQueryCommand[]): BatchQueryResult
  executeBatchAsync(
    dbName: string,
    commands: BatchQueryCommand[],
  ): Promise<BatchQueryResult>
  loadFile(dbName: string, location: string): FileLoadResult
  loadFileAsync(dbName: string, location: string): Promise<FileLoadResult>
}
