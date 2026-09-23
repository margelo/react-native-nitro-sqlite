import { HybridNitroSQLite } from '../nitro'
import {
  queueStatementAsync,
  startOperationSync,
  throwIfDatabaseIsNotOpen,
} from '../DatabaseQueue'
import NitroSQLiteError from '../NitroSQLiteError'
import type { BatchQueryCommand, BatchQueryResult } from '../types'
import type { DatabaseQueueKey } from '../DatabaseQueue'

/** Execute a batch synchronously in one exclusive transaction.
 * Requires an open managed connection; throws if it is busy or the batch is empty.
 * @param dbName Name of the open database.
 * @param commands SQL commands and optional parameter sets.
 * @returns Total affected row count.
 */
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

/** Queue a batch in one exclusive transaction.
 * Requires an open managed connection; a failed command rolls back the batch.
 * @param dbName Name of the open database.
 * @param commands SQL commands and optional parameter sets.
 * @returns A promise of the total affected row count.
 */
export async function executeBatchAsync(
  dbName: string,
  commands: BatchQueryCommand[],
  queueKey: DatabaseQueueKey = dbName,
): Promise<BatchQueryResult> {
  throwIfDatabaseIsNotOpen(queueKey)

  return queueStatementAsync(queueKey, async () => {
    try {
      return await HybridNitroSQLite.executeBatchAsync(dbName, commands)
    } catch (error) {
      throw NitroSQLiteError.fromError(error)
    }
  })
}
