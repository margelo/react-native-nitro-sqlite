import { HybridNitroSQLite } from '../nitro'
import {
  queueOperationAsync,
  startOperationSync,
  throwIfDatabaseIsNotOpen,
} from '../DatabaseQueue'
import NitroSQLiteError from '../NitroSQLiteError'
import type { BatchQueryCommand, BatchQueryResult } from '../types'

export function executeBatch(
  dbName: string,
  commands: BatchQueryCommand[],
): BatchQueryResult {
  throwIfDatabaseIsNotOpen(dbName)

  try {
    return startOperationSync(dbName, () =>
      HybridNitroSQLite.executeBatch(dbName, commands),
    )
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}

export async function executeBatchAsync(
  dbName: string,
  commands: BatchQueryCommand[],
): Promise<BatchQueryResult> {
  throwIfDatabaseIsNotOpen(dbName)

  return queueOperationAsync(dbName, async () => {
    try {
      return await HybridNitroSQLite.executeBatchAsync(dbName, commands)
    } catch (error) {
      throw NitroSQLiteError.fromError(error)
    }
  })
}
