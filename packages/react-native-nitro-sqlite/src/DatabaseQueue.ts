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
  let databaseQueue: DatabaseQueue
  try {
    databaseQueue = getDatabaseQueue(dbName)
  } catch (error) {
    return Promise.reject(error)
  }

  // Nothing is waiting and no transaction or synchronous call holds the queue.
  const canStartStatementNow =
    kind === 'statement' &&
    databaseQueue.queue.length === 0 &&
    (!databaseQueue.inProgress || databaseQueue.activeStatements > 0)
  if (canStartStatementNow) return startStatement(databaseQueue, callback)

  return new Promise<Result>((resolve, reject) => {
    const finish = () => finishOperation(databaseQueue, kind)

    // Chains the operation directly instead of awaiting it in an async function,
    // which saves a promise and several microtask turns per queued query.
    const start = () => {
      let operation: Promise<Result>
      try {
        operation = Promise.resolve(callback())
      } catch (error) {
        reject(error)
        finish()
        return
      }
      operation.then(
        (result) => {
          resolve(result)
          finish()
        },
        (error: unknown) => {
          reject(error)
          finish()
        },
      )
    }

    const operation: QueuedOperation = {
      kind,
      start,
    }

    databaseQueue.queue.push(operation)
    startNextOperations(databaseQueue)
  })
}

/** Starts a statement right away and chains the queue update onto its promise,
 * without the queued path's extra promise, entry object and closures.
 */
function startStatement<Result>(
  databaseQueue: DatabaseQueue,
  callback: () => Promise<Result>,
): Promise<Result> {
  databaseQueue.inProgress = true
  databaseQueue.activeStatements++
  let operation: Promise<Result>
  try {
    operation = Promise.resolve(callback())
  } catch (error) {
    finishOperation(databaseQueue, 'statement')
    return Promise.reject(error)
  }
  return operation.then(
    (result) => {
      finishOperation(databaseQueue, 'statement')
      return result
    },
    (error: unknown) => {
      finishOperation(databaseQueue, 'statement')
      throw error
    },
  )
}

function finishOperation(
  databaseQueue: DatabaseQueue,
  kind: QueuedOperation['kind'],
) {
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
