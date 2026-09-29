import NitroSQLiteError from './NitroSQLiteError'

export interface QueuedOperation {
  kind: 'statement' | 'exclusive'
  /**
   * Starts the operation
   */
  start: () => void
}

export type DatabaseQueue = {
  queue: QueuedOperation[]
  inProgress: boolean
  activeStatements: number
  draining: boolean
}

/** Identity of a managed connection's operation queue. Application code should
 * omit the optional queue key on package helpers; connections choose it for you.
 */
export type DatabaseQueueKey = string | symbol

const databaseQueues = new Map<DatabaseQueueKey, DatabaseQueue>()

export function openDatabaseQueue(dbName: DatabaseQueueKey) {
  if (isDatabaseOpen(dbName)) {
    throw new NitroSQLiteError(
      `Database ${String(dbName)} is already open. There is already a connection to the database.`,
    )
  }

  databaseQueues.set(dbName, {
    queue: [],
    inProgress: false,
    activeStatements: 0,
    draining: false,
  })
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
): Promise<Result> {
  return enqueueOperation(dbName, 'exclusive', callback)
}

export function queueStatementAsync<Result>(
  dbName: DatabaseQueueKey,
  callback: () => Promise<Result>,
): Promise<Result> {
  return enqueueOperation(dbName, 'statement', callback)
}

function enqueueOperation<Result>(
  dbName: DatabaseQueueKey,
  kind: QueuedOperation['kind'],
  callback: () => Promise<Result>,
): Promise<Result> {
  const databaseQueue = getDatabaseQueue(dbName)

  return new Promise<Result>((resolve, reject) => {
    async function start() {
      try {
        const result = await callback()
        resolve(result)
      } catch (error) {
        reject(error)
      } finally {
        if (kind === 'statement') {
          databaseQueue.activeStatements--
          if (databaseQueue.activeStatements === 0) {
            databaseQueue.inProgress = false
          }
        } else {
          databaseQueue.inProgress = false
        }
        startNextOperations(databaseQueue)
      }
    }

    const operation: QueuedOperation = {
      kind,
      start,
    }

    databaseQueue.queue.push(operation)
    startNextOperations(databaseQueue)
  })
}

function startNextOperations(queue: DatabaseQueue) {
  if (queue.draining || (queue.inProgress && queue.activeStatements === 0)) {
    return
  }

  queue.draining = true
  try {
    while (queue.queue.length > 0) {
      const exclusiveIndex = queue.queue.findIndex(
        (operation) => operation.kind === 'exclusive',
      )
      const statementCount =
        exclusiveIndex === -1 ? queue.queue.length : exclusiveIndex

      if (statementCount > 0) {
        const statements = queue.queue.splice(0, statementCount)
        queue.inProgress = true
        queue.activeStatements += statements.length
        for (const statement of statements) statement.start()
        continue
      }

      if (queue.activeStatements > 0) return

      queue.inProgress = true
      queue.queue.shift()!.start()
      return
    }
  } finally {
    queue.draining = false
  }
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
    startNextOperations(databaseQueue)
  }
}
