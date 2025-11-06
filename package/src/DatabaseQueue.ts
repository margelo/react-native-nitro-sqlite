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
      `Database ${dbName} is already open. There is already a connection to the database.`,
    )
  }

  databaseQueues.set(dbName, { queue: [], inProgress: false })
}

export function closeDatabaseQueue(dbName: string) {
  const databaseQueue = getDatabaseQueue(dbName)

  if (databaseQueue.inProgress || databaseQueue.queue.length > 0) {
    console.warn(
      `Database queue for ${dbName} has operations in the queue. Closing anyway.`,
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
      `Database ${dbName} is not open. There is no connection to the database.`,
    )
}

export function getDatabaseQueue(dbName: string) {
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

export function queueOperationAsync<Result>(
  dbName: string,
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
        startOperationAsync(dbName)
      }
    }

    const operation: QueuedOperation = {
      start,
    }

    databaseQueue.queue.push(operation)
    startOperationAsync(dbName)
  })
}

function startOperationAsync(dbName: string) {
  const queue = getDatabaseQueue(dbName)

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

export function startOperationSync<
  OperationCallback extends () => Result,
  Result = void,
>(dbName: string, callback: OperationCallback) {
  const databaseQueue = getDatabaseQueue(dbName)

  // Database is busy - cannot execute synchronously
  if (databaseQueue.inProgress || databaseQueue.queue.length > 0) {
    throw new NitroSQLiteError(
      `Cannot run synchronous operation on database. Database ${dbName} is busy with another operation.`,
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
