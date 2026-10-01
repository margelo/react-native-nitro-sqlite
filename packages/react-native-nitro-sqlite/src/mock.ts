/**
 * Adapted from the Onyx SQLite mock originally authored by Hubert Sosinski.
 * https://github.com/Expensify/react-native-onyx/blob/main/tests/unit/mocks/sqliteMock.ts
 * See THIRD_PARTY_NOTICES.md for the original MIT license notice.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import BetterSqlite3 from 'better-sqlite3'
import {
  closeDatabaseQueue,
  getDatabaseQueue,
  openDatabaseQueue,
  queueOperationAsync,
  queueStatementAsync,
  startOperationSync,
} from './DatabaseQueue'
import NitroSQLiteError from './NitroSQLiteError'
import type { NitroSQLiteConnectionOptions, PreparedStatement } from './types'
import type { MockConnection } from './mock/MockConnection'
import { executeBatch, executePrepared, executeQuery } from './mock/query'
import { runTransaction } from './mock/transaction'

export type { MockConnection } from './mock/MockConnection'

type Database = InstanceType<typeof BetterSqlite3>
type Statement = BetterSqlite3.Statement<unknown[], Record<string, unknown>>
type ConnectionRecord = {
  database: Database
  path: string
  queueKey: symbol
  close: () => void
}
const connections = new Set<ConnectionRecord>()
const defaultConnections = new Map<string, ConnectionRecord>()
let databaseDirectory: string | undefined

/**
 * Open a SQLite database in a temporary directory for Node tests.
 * Connections with the same name and location share a file. Opening a second
 * default connection with the same name throws; independent connections have
 * separate handles and queues. Read-only opens require an existing database.
 * Closing preserves data until deletion or {@linkcode resetAllDatabases}.
 * @param options Name, relative location, connection mode, and read-only setting.
 * @returns A connection supporting queries, batches, prepared statements, and transactions.
 * @throws If the name or location escapes the temporary directory, the database
 * cannot be opened, or a default connection already uses the name.
 * @see {@linkcode MockConnection}
 */
export function open(options: NitroSQLiteConnectionOptions): MockConnection {
  const { name, connection, readOnly = false } = options
  if (connection !== 'independent' && defaultConnections.has(name)) {
    throw new NitroSQLiteError(`Database ${name} is already open.`)
  }
  const path = getDatabasePath(options)
  if (!readOnly) mkdirSync(dirname(path), { recursive: true })
  const database = new BetterSqlite3(path, {
    readonly: readOnly,
    fileMustExist: readOnly,
  })
  const queueKey = Symbol(name)
  openDatabaseQueue(queueKey)

  const runSync = <Result>(callback: () => Result) =>
    startOperationSync(queueKey, callback)
  const runAsync = async <Result>(
    callback: () => Result,
    exclusive = false,
  ) => {
    const enqueue = exclusive ? queueOperationAsync : queueStatementAsync
    return enqueue(queueKey, () => Promise.resolve().then(callback))
  }
  const close = () => {
    runSync(() => database.close())
    closeDatabaseQueue(queueKey)
    connections.delete(record)
    if (defaultConnections.get(name) === record) defaultConnections.delete(name)
  }
  const record: ConnectionRecord = { database, path, queueKey, close }
  connections.add(record)
  if (connection !== 'independent') defaultConnections.set(name, record)

  return {
    close,
    delete: () => {
      const replacement = defaultConnections.get(name)
      if (
        connection !== 'independent' &&
        replacement &&
        replacement !== record
      ) {
        throw new NitroSQLiteError(
          'Database has been reopened with another connection.',
        )
      }
      if (readOnly)
        throw new NitroSQLiteError(`Cannot delete read-only database ${name}.`)
      if (
        [...connections].some(
          (other) => other !== record && other.path === path,
        )
      ) {
        throw new NitroSQLiteError('Database is in use by another connection.')
      }
      if (connections.has(record)) close()
      for (const suffix of ['', '-wal', '-shm', '-journal'])
        rmSync(`${path}${suffix}`, { force: true })
    },
    execute: (query, params) =>
      runSync(() => executeQuery(database, query, params)),
    executeAsync: (query, params) =>
      runAsync(() => executeQuery(database, query, params)),
    executeBatch: (commands) => runSync(() => executeBatch(database, commands)),
    executeBatchAsync: (commands) =>
      runAsync(() => executeBatch(database, commands), true),
    prepare: (query): PreparedStatement => {
      let statement: Statement | undefined = runSync(() =>
        database.prepare(query),
      )
      const execute: PreparedStatement['execute'] = (params) => {
        if (!statement)
          throw new NitroSQLiteError('Prepared statement is finalized.')
        return executePrepared(database, statement, params)
      }
      return {
        get isFinalized() {
          return statement === undefined
        },
        execute: (params) => runSync(() => execute(params)),
        executeAsync: (params) => runAsync(() => execute(params), true),
        finalize: () =>
          runSync(() => {
            // better-sqlite3 releases statement resources when the object is collected.
            statement = undefined
          }),
      }
    },
    transaction: async (callback) =>
      queueOperationAsync(queueKey, () => runTransaction(database, callback)),
  }
}

/** Node test entry point. {@linkcode NitroSQLite.open} is the same factory as {@linkcode open}. */
export const NitroSQLite = { open }

/**
 * Close all mock connections and remove every temporary database and sidecar file.
 * Call after awaiting all async work, for example in a test's `afterEach` hook.
 * Existing connections and prepared statements cannot execute after a reset.
 * @throws If any connection still has running or queued work. No connections are
 * closed when this check fails, so await that work and retry the reset.
 * @see {@linkcode open}
 */
export function resetAllDatabases(): void {
  for (const { queueKey } of connections) {
    const queue = getDatabaseQueue(queueKey)
    if (queue.inProgress || queue.queue.length > 0) {
      throw new NitroSQLiteError(
        'Cannot reset mock databases while a connection is busy.',
      )
    }
  }
  for (const record of connections) record.close()
  if (databaseDirectory)
    rmSync(databaseDirectory, { recursive: true, force: true })
  databaseDirectory = undefined
}

function getDatabasePath({
  name,
  location = '',
}: NitroSQLiteConnectionOptions): string {
  if (
    !name ||
    name === '.' ||
    name === '..' ||
    name.includes('/') ||
    name.includes('\\')
  ) {
    throw new NitroSQLiteError('Database name must be a file name.')
  }
  if (!databaseDirectory)
    databaseDirectory = mkdtempSync(join(tmpdir(), 'nitro-sqlite-test-'))
  const directory = resolve(databaseDirectory, location)
  const relativeDirectory = relative(databaseDirectory, directory)
  if (relativeDirectory === '..' || relativeDirectory.startsWith(`..${sep}`)) {
    throw new NitroSQLiteError(
      'Database location must stay inside the temporary directory.',
    )
  }
  return join(directory, name)
}
