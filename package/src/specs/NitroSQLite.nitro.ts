import type { HybridObject } from 'react-native-nitro-modules'
import type {
  BatchQueryResult,
  FileLoadResult,
  NativeSQLiteQueryParams,
  NativeBatchQueryCommand,
} from '../types'
import type { NativeQueryResult } from './NativeQueryResult.nitro'

export interface NitroSQLite
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  open(dbName: string, location?: string): void
  close(dbName: string): void
  drop(dbName: string, location?: string): void
  attach(
    mainDbName: string,
    dbNameToAttach: string,
    alias: string,
    location?: string
  ): void
  detach(mainDbName: string, alias: string): void
  execute(
    dbName: string,
    query: string,
    params?: NativeSQLiteQueryParams
  ): NativeQueryResult
  executeAsync(
    dbName: string,
    query: string,
    params?: NativeSQLiteQueryParams
  ): Promise<NativeQueryResult>
  executeBatch(
    dbName: string,
    commands: NativeBatchQueryCommand[]
  ): BatchQueryResult
  executeBatchAsync(
    dbName: string,
    commands: NativeBatchQueryCommand[]
  ): Promise<BatchQueryResult>
  loadFile(dbName: string, location: string): FileLoadResult
  loadFileAsync(dbName: string, location: string): Promise<FileLoadResult>
  loadExtension(dbName: string, path: string, entryPoint?: string): void
}
