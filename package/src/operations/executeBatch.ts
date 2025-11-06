import {
  isSimpleNullHandlingEnabled,
  replaceWithNativeNullValue,
} from '../nullHandling'
import { HybridNitroSQLite } from '../nitro'
import {
  queueOperationAsync,
  startOperationSync,
  throwIfDatabaseIsNotOpen,
} from '../DatabaseQueue'
import type {
  NativeSQLiteQueryParams,
  BatchQueryResult,
  BatchQueryCommand,
  NativeBatchQueryCommand,
} from '../types'
import NitroSQLiteError from '../NitroSQLiteError'

export function executeBatch(
  dbName: string,
  commands: BatchQueryCommand[],
): BatchQueryResult {
  throwIfDatabaseIsNotOpen(dbName)

  const transformedCommands = isSimpleNullHandlingEnabled()
    ? toNativeBatchQueryCommands(commands)
    : (commands as NativeBatchQueryCommand[])

  try {
    return startOperationSync(dbName, () =>
      HybridNitroSQLite.executeBatch(dbName, transformedCommands),
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

  const transformedCommands = isSimpleNullHandlingEnabled()
    ? toNativeBatchQueryCommands(commands)
    : (commands as NativeBatchQueryCommand[])

  return queueOperationAsync(dbName, async () => {
    try {
      return await HybridNitroSQLite.executeBatchAsync(
        dbName,
        transformedCommands,
      )
    } catch (error) {
      throw NitroSQLiteError.fromError(error)
    }
  })
}

function toNativeBatchQueryCommands(
  commands: BatchQueryCommand[],
): NativeBatchQueryCommand[] {
  return commands.map((command) => {
    const transformedParams = command.params?.map((param) => {
      if (Array.isArray(param)) {
        return param.map((p) => replaceWithNativeNullValue(p))
      }
      return replaceWithNativeNullValue(param)
    }) as NativeSQLiteQueryParams | NativeSQLiteQueryParams[]

    return {
      query: command.query,
      params: transformedParams,
    }
  })
}
