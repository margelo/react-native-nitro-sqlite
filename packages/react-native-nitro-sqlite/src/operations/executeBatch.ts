import { HybridNitroSQLite } from '../nitro'
import {
  queueOperationAsync,
  startOperationSync,
  throwIfDatabaseIsNotOpen,
} from '../DatabaseQueue'
import NitroSQLiteError from '../NitroSQLiteError'
import type { BatchQueryCommand, BatchQueryResult } from '../types'
import type { DatabaseQueueKey } from '../DatabaseQueue'

export function executeBatch(
  dbName: string,
  commands: BatchQueryCommand[],
  queueKey: DatabaseQueueKey = dbName,
): BatchQueryResult {
  throwIfDatabaseIsNotOpen(queueKey)

  try {
    return startOperationSync(queueKey, () =>
      HybridNitroSQLite.executeBatch(dbName, commands),
    )
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}

export async function executeBatchAsync(
  dbName: string,
  commands: BatchQueryCommand[],
  queueKey: DatabaseQueueKey = dbName,
): Promise<BatchQueryResult> {
  throwIfDatabaseIsNotOpen(queueKey)

  return queueOperationAsync(queueKey, async () => {
    try {
      return await HybridNitroSQLite.executeBatchAsync(dbName, commands)
    } catch (error) {
      throw NitroSQLiteError.fromError(error)
    }
  })
}
