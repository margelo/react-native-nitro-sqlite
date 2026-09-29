import type { NitroSQLiteQueryResult } from './specs/NitroSQLiteQueryResult.nitro'

/** Options for `open()` and `NitroSQLite.open()`. */
export interface NitroSQLiteConnectionOptions {
  /** Database file name. Only one managed connection may use a name at a time. */
  name: string
  /** Directory relative to the platform's database directory. */
  location?: string
  /**
   * Choose a connection to the database file. The default connection is addressed
   * by `name`, so opening it twice throws. Each `independent` connection has its
   * own native handle and operation queue and can share a file with other connections.
   * Defaults to `'default'`.
   */
  connection?: 'default' | 'independent'
  /**
   * Open an existing database without write access. Opening fails if the file does
   * not exist. A read-only connection cannot write, attach, or delete a database.
   * Defaults to `false`.
   */
  readOnly?: boolean
}

/** A managed connection bound to one database name. Do not use it after closing or deleting it. */
export interface NitroSQLiteConnection {
  /** Close the connection. Throws if a queued operation is running or pending. */
  close(): void
  /** Delete the database file and end this connection. Throws if the connection is busy.
   * This also closes the native handle if it is open.
   */
  delete(): void
  /** Attach another database under `alias` for queries against this connection.
   * @param dbNameToAttach File name of the database to attach.
   * @param alias SQL schema name for the attached database.
   * @param location Directory relative to the platform database directory.
   */
  attach(dbNameToAttach: string, alias: string, location?: string): void
  /** Detach the database identified by `alias`.
   * @param alias SQL schema name used when attaching the database.
   */
  detach(alias: string): void
  /** Run a callback in a queued transaction. The callback must use `tx` for database work.
   * It commits on success and rolls back on error unless explicitly finalized.
   * Awaiting another queued operation for this database inside the callback deadlocks.
   * Synchronous connection methods throw while this transaction is active.
   * @param transactionCallback Async callback receiving the transaction handle.
   * @returns The callback's result after the transaction finishes.
   */
  transaction: <Result = void>(
    transactionCallback: (tx: Transaction) => Promise<Result>,
  ) => Promise<Result>
  /** Execute one SQL statement synchronously. Throws while the connection is busy. */
  execute: ExecuteQuery
  /** Queue one SQL statement and resolve with its result. */
  executeAsync: ExecuteAsyncQuery
  /**
   * Prepare one SQL statement on this connection for repeated execution.
   * Finalize the returned statement before closing the connection.
   * @param query SQL statement with optional positional placeholders.
   */
  prepare(query: string): PreparedStatement
  /** Execute commands in one exclusive transaction. Throws while the connection is busy.
   * @param commands SQL commands and optional parameter sets.
   * @returns Total affected row count.
   */
  executeBatch(commands: BatchQueryCommand[]): BatchQueryResult
  /** Queue commands in one exclusive transaction.
   * @param commands SQL commands and optional parameter sets.
   * @returns A promise of the total affected row count.
   */
  executeBatchAsync(commands: BatchQueryCommand[]): Promise<BatchQueryResult>
  /** Execute one non-empty SQL command per file line in an exclusive transaction.
   * `location` is a path to the SQL file; multi-line statements are unsupported.
   * @param location Path to the SQL file.
   * @returns Number of executed commands and affected rows.
   */
  loadFile(location: string): FileLoadResult
  /** Queue the file import and resolve with its command and row counts.
   * @param location Path to the SQL file.
   */
  loadFileAsync(location: string): Promise<FileLoadResult>
}

/** SQLite value categories reported in query column metadata. */
export enum ColumnType {
  /** Boolean declaration. */
  BOOLEAN,
  /** Floating point declaration. */
  NUMBER,
  /** Integer declaration. */
  INT64,
  /** Text declaration. */
  TEXT,
  /** Blob declaration. */
  ARRAY_BUFFER,
  /** Missing or unrecognized declaration. */
  NULL_VALUE,
}

/** SQL value. `undefined` binds as SQL NULL; result rows return `null`. */
export type SQLiteValue =
  | boolean
  | number
  | string
  | ArrayBuffer
  | null
  | undefined

/** Positional values for SQL placeholders. */
export type SQLiteQueryParams = SQLiteValue[]

/** A row keyed by result column names. */
export type QueryResultRow = Record<string, SQLiteValue>

/** Query result with a row adapter for TypeORM-style consumers. */
export type QueryResult<Row extends QueryResultRow = QueryResultRow> =
  NitroSQLiteQueryResult & {
    /** Query rows in a TypeORM-compatible collection. */
    rows: NitroSQLiteQueryResultRows<Row>
  }

/** Indexable view of query rows. */
export type NitroSQLiteQueryResultRows<
  Row extends Record<string, SQLiteValue> = Record<string, SQLiteValue>,
> = {
  /** All returned rows. */
  _array: Row[]

  /** Number of returned rows. */
  length: number

  /** Get a row by zero-based index; returns `undefined` when out of range.
   * @param idx Row index.
   */
  item: (idx: number) => Row | undefined
}

/** Execute one SQL statement synchronously and return its typed rows.
 * @param query SQL statement with optional positional placeholders.
 * @param params Values bound to the placeholders.
 */
export type ExecuteQuery = <Row extends QueryResultRow = QueryResultRow>(
  query: string,
  params?: SQLiteQueryParams,
) => QueryResult<Row>

/** Queue one SQL statement and resolve with its typed rows.
 * @param query SQL statement with optional positional placeholders.
 * @param params Values bound to the placeholders.
 */
export type ExecuteAsyncQuery = <Row extends QueryResultRow = QueryResultRow>(
  query: string,
  params?: SQLiteQueryParams,
) => Promise<QueryResult<Row>>

/**
 * A reusable SQL statement bound to the connection that prepared it. Each
 * execution resets the statement and its bindings before applying new values.
 * Finalize it before closing the connection.
 */
export interface PreparedStatement {
  /** Whether `finalize()` has released the native statement. */
  readonly isFinalized: boolean
  /** Execute on the calling thread. Throws if the statement is finalized, its connection is closed, or the managed connection is busy. */
  execute: ExecutePreparedStatement
  /** Queue execution on a background thread and resolve with the query result. */
  executeAsync: ExecutePreparedStatementAsync
  /** Release the native statement. Calling this more than once is safe. */
  finalize(): void
}

/**
 * Execute a prepared statement with optional positional values and return typed rows.
 * Each call replaces the previous parameter bindings.
 * @param params Values bound to the statement's positional placeholders.
 */
export type ExecutePreparedStatement = <
  Row extends QueryResultRow = QueryResultRow,
>(
  params?: SQLiteQueryParams,
) => QueryResult<Row>

/**
 * Queue a prepared statement execution and resolve with typed rows. Calls on the
 * same managed connection run in queue order.
 * @param params Values bound to the statement's positional placeholders.
 */
export type ExecutePreparedStatementAsync = <
  Row extends QueryResultRow = QueryResultRow,
>(
  params?: SQLiteQueryParams,
) => Promise<QueryResult<Row>>

/** Handle valid only while its transaction callback is active. */
export interface Transaction {
  /** Commit now. Further operations on this transaction throw. */
  commit(): NitroSQLiteQueryResult
  /** Roll back now. Further operations on this transaction throw. */
  rollback(): NitroSQLiteQueryResult
  /** Execute within this transaction on the calling thread. */
  execute: ExecuteQuery
  /** Execute within this transaction on a background thread. */
  executeAsync: ExecuteAsyncQuery
}

/** One command in a batch. A nested `params` array repeats the query for each parameter set. */
export interface BatchQueryCommand {
  /** SQL statement to execute. */
  query: string
  /** One parameter set, or several sets for repeated execution. */
  params?: SQLiteQueryParams | SQLiteQueryParams[]
}

/** Result of a committed SQL batch. Errors are thrown rather than returned here. */
export interface BatchQueryResult {
  /** Total number of rows changed by the batch. */
  rowsAffected?: number
}

/** Result of importing a SQL file in one transaction. */
export interface FileLoadResult extends BatchQueryResult {
  /** Number of non-empty lines executed as SQL commands. */
  commands?: number
}
