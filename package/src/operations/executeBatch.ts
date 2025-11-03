import {
  isSimpleNullHandlingEnabled,
  replaceWithNativeNullValue,
} from '../nullHandling'
import { HybridNitroSQLite } from '../nitro'
import { locks, type QueuedOperation } from '../concurrency'
import type {
  NativeSQLiteQueryParams,
  BatchQueryResult,
  BatchQueryCommand,
  NativeBatchQueryCommand,
} from '../types'
import { startNextOperation } from './transaction'

export function executeBatch(
  dbName: string,
  commands: BatchQueryCommand[]
): BatchQueryResult {
  if (locks[dbName] == null)
    throw Error(`Nitro SQLite Error: No lock found on db: ${dbName}`)

  const transformedCommands = isSimpleNullHandlingEnabled()
    ? toNativeBatchQueryCommands(commands)
    : (commands as NativeBatchQueryCommand[])

  // If lock is immediately available, execute synchronously
  if (!locks[dbName].inProgress && locks[dbName].queue.length === 0) {
    locks[dbName].inProgress = true
    try {
      const result = HybridNitroSQLite.executeBatch(dbName, transformedCommands)
      return result
    } finally {
      locks[dbName].inProgress = false
      startNextOperation(dbName)
    }
  }

  // Lock is busy - cannot execute synchronously
  throw Error(
    `Nitro SQLite Error: Database ${dbName} is busy with another operation. Use executeBatchAsync for queued execution.`
  )
}

export async function executeBatchAsync(
  dbName: string,
  commands: BatchQueryCommand[]
): Promise<BatchQueryResult> {
  if (locks[dbName] == null)
    throw Error(`Nitro SQLite Error: No lock found on db: ${dbName}`)

  const transformedCommands = isSimpleNullHandlingEnabled()
    ? toNativeBatchQueryCommands(commands)
    : (commands as NativeBatchQueryCommand[])

  async function run() {
    try {
      const result = await HybridNitroSQLite.executeBatchAsync(
        dbName,
        transformedCommands
      )
      return result
    } finally {
      locks[dbName]!.inProgress = false
      startNextOperation(dbName)
    }
  }

  return new Promise<BatchQueryResult>((resolve, reject) => {
    const operation: QueuedOperation = {
      start: () => {
        run().then(resolve).catch(reject)
      },
    }

    locks[dbName]?.queue.push(operation)
    startNextOperation(dbName)
  })
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
