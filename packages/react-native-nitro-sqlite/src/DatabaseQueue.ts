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

export type DatabaseQueueKey = string | symbol

const databaseQueues = new Map<DatabaseQueueKey, DatabaseQueue>()

export function openDatabaseQueue(dbName: DatabaseQueueKey) {
  if (isDatabaseOpen(dbName)) {
    throw new NitroSQLiteError(
      `Database ${String(dbName)} is already open. There is already a connection to the database.`,
    )
  }

  databaseQueues.set(dbName, { queue: [], inProgress: false })
}

export function closeDatabaseQueue(dbName: DatabaseQueueKey) {
  const databaseQueue = getDatabaseQueue(dbName)

  if (databaseQueue.inProgress || databaseQueue.queue.length > 0) {
    throw new NitroSQLiteError(
      `Cannot close database ${String(dbName)}. The database is busy with another operation.`,
    )
  }

  databaseQueues.delete(dbName)
}

export function isDatabaseOpen(dbName: DatabaseQueueKey) {
  return databaseQueues.has(dbName)
}

export function throwIfDatabaseIsNotOpen(dbName: DatabaseQueueKey) {
  if (!isDatabaseOpen(dbName))
    throw new NitroSQLiteError(
      `Database ${String(dbName)} is not open. There is no connection to the database.`,
    )
}

export function getDatabaseQueue(dbName: DatabaseQueueKey) {
  throwIfDatabaseIsNotOpen(dbName)

  const queue = databaseQueues.get(dbName)!
  return queue
}

export function queueOperationAsync<Result>(
  dbName: DatabaseQueueKey,
  callback: () => Promise<Result>,
) {
  const databaseQueue = getDatabaseQueue(dbName)

  return new Promise<Result>((resolve, reject) => {
    async function start() {
      try {
        const result = await callback()
        resolve(result)
      } catch (error) {
        reject(error)
      } finally {
        databaseQueue.inProgress = false
        startOperationAsync(databaseQueue)
      }
    }

    const operation: QueuedOperation = {
      start,
    }

    databaseQueue.queue.push(operation)
    startOperationAsync(databaseQueue)
  })
}

function startOperationAsync(queue: DatabaseQueue) {
  // Queue is empty or in progress. Bail out.
  if (queue.inProgress || queue.queue.length === 0) {
    return
  }

  queue.inProgress = true

  const operation = queue.queue.shift()!
  setImmediate(() => {
    operation.start()
  })
}

export function startOperationSync<Result>(
  dbName: DatabaseQueueKey,
  callback: () => Result,
): Result {
  const databaseQueue = getDatabaseQueue(dbName)

  // Database is busy - cannot execute synchronously
  if (databaseQueue.inProgress || databaseQueue.queue.length > 0) {
    throw new NitroSQLiteError(
      `Cannot run synchronous operation on database. Database ${String(dbName)} is busy with another operation.`,
    )
  }

  // Execute synchronously
  databaseQueue.inProgress = true
  try {
    return callback()
  } finally {
    databaseQueue.inProgress = false
  }
}
