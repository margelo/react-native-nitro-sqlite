import {
  isSimpleNullHandlingEnabled,
  replaceWithNativeNullValue,
} from '../nullHandling'
import { HybridNitroSQLite } from '../nitro'
import type {
  NativeSQLiteQueryParams,
  BatchQueryResult,
  BatchQueryCommand,
  NativeBatchQueryCommand,
} from '../types'

export function executeBatch(
  dbName: string,
  commands: BatchQueryCommand[]
): BatchQueryResult {
  const transformedCommands = isSimpleNullHandlingEnabled()
    ? toNativeBatchQueryCommands(commands)
    : (commands as NativeBatchQueryCommand[])

  const result = HybridNitroSQLite.executeBatch(dbName, transformedCommands)
  return result
}

export async function executeBatchAsync(
  dbName: string,
  commands: BatchQueryCommand[]
): Promise<BatchQueryResult> {
  const transformedCommands = isSimpleNullHandlingEnabled()
    ? toNativeBatchQueryCommands(commands)
    : (commands as NativeBatchQueryCommand[])

  const result = await HybridNitroSQLite.executeBatchAsync(
    dbName,
    transformedCommands
  )
  return result
}

function toNativeBatchQueryCommands(
  commands: BatchQueryCommand[]
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
