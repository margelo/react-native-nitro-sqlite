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

const databaseQueues = new Map<string, DatabaseQueue>()

export function openDatabaseQueue(dbName: string) {
  if (isDatabaseOpen(dbName)) {
    throw new NitroSQLiteError(
      `Database ${dbName} is already open. There is already a connection to the database.`,
    )
  }

  databaseQueues.set(dbName, {
    queue: [],
    inProgress: false,
    activeStatements: 0,
    draining: false,
  })
}

export function closeDatabaseQueue(dbName: string) {
  const databaseQueue = getDatabaseQueue(dbName)

  if (databaseQueue.inProgress || databaseQueue.queue.length > 0) {
    throw new NitroSQLiteError(
      `Cannot close database ${dbName}. The database is busy with another operation.`,
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

export function queueOperationAsync<Result>(
  dbName: string,
  callback: () => Promise<Result>,
): Promise<Result> {
  return enqueueOperation(dbName, 'exclusive', callback)
}

export function queueStatementAsync<Result>(
  dbName: string,
  callback: () => Promise<Result>,
): Promise<Result> {
  return enqueueOperation(dbName, 'statement', callback)
}

function enqueueOperation<Result>(
  dbName: string,
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
  dbName: string,
  callback: () => Result,
): Result {
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
    startNextOperations(databaseQueue)
  }
}
