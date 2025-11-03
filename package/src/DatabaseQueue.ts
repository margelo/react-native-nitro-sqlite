import NitroSQLiteError from './NitroSQLiteError'

export interface QueuedOperation {
  /**
   * Starts the operation
   */
  start: () => void
}

export type DatabaseQueue = {
  queue: QueuedOperation[]
  inProgress: boolean
}

const databaseQueues = new Map<string, DatabaseQueue>()

export function openDatabaseQueue(dbName: string) {
  if (isDatabaseOpen(dbName)) {
    throw new NitroSQLiteError(
      `Database ${dbName} is already open. There is already a connection to the database.`
    )
  }

  databaseQueues.set(dbName, { queue: [], inProgress: false })
}

export function closeDatabaseQueue(dbName: string) {
  const queue = getDatabaseQueue(dbName)

  if (queue.inProgress || queue.queue.length > 0) {
    console.warn(
      `Database queue for ${dbName} has operations in the queue. Closing anyway.`
    )
  }

  databaseQueues.delete(dbName)
}

export function isDatabaseOpen(dbName: string) {
  return databaseQueues.has(dbName)
}

export function throwIfDatabaseIsNotOpen(dbName: string) {
  if (!isDatabaseOpen(dbName))
    throw new NitroSQLiteError(
      `Database ${dbName} is not open. There is no connection to the database.`
    )
}

function getDatabaseQueue(dbName: string) {
  throwIfDatabaseIsNotOpen(dbName)

  const queue = databaseQueues.get(dbName)!
  return queue
}

export function openDatabase(dbName: string) {
  databaseQueues.set(dbName, { queue: [], inProgress: false })
}

export function closeDatabase(dbName: string) {
  databaseQueues.delete(dbName)
}

export function queueOperationAsync<
  OperationCallback extends () => Promise<Result>,
  Result = void,
>(dbName: string, callback: OperationCallback) {
  const queue = getDatabaseQueue(dbName)

  return new Promise<Result>((resolve, reject) => {
    const operation: QueuedOperation = {
      start: async () => {
        try {
          const result = await callback()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          queue.inProgress = false
          startOperationAsync(dbName)
        }
      },
    }

    queue.queue.push(operation)
    startOperationAsync(dbName)
  })
}

function startOperationAsync(dbName: string) {
  const queue = getDatabaseQueue(dbName)

  if (queue.inProgress) {
    // Operation is already in process bail out
    return
  }

  if (queue.queue.length > 0) {
    queue.inProgress = true

    const operation = queue.queue.shift()!
    setImmediate(() => {
      operation.start()
    })
  }
}

export function startOperationSync<
  OperationCallback extends () => Result,
  Result = void,
>(dbName: string, callback: OperationCallback) {
  const queue = getDatabaseQueue(dbName)

  // Database is busy - cannot execute synchronously
  if (queue.inProgress || queue.queue.length > 0) {
    throw new NitroSQLiteError(
      `Cannot run synchronous operation on database. Database ${dbName} is busy with another operation.`
    )
  }

  // Execute synchronously
  queue.inProgress = true
  const result = callback()
  queue.inProgress = false

  return result
}
