export interface NitroSQLiteConnectionOptions {
  name: string
  location?: string
}

export interface NitroSQLiteConnection {
  close(): void
  delete(): void
  attach(dbNameToAttach: string, alias: string, location?: string): void
  detach(alias: string): void
  transaction(fn: (tx: Transaction) => Promise<void> | void): Promise<void>
  execute: ExecuteQuery
  executeAsync: ExecuteAsyncQuery
  executeBatch(commands: BatchQueryCommand[]): BatchQueryResult
  executeBatchAsync(commands: BatchQueryCommand[]): Promise<BatchQueryResult>
  loadFile(location: string): FileLoadResult
  loadFileAsync(location: string): Promise<FileLoadResult>
}

export enum ColumnType {
  BOOLEAN,
  NUMBER,
  INT64,
  TEXT,
  ARRAY_BUFFER,
  NULL_VALUE,
}

// Passing null/undefined in array types is not possible, so we us a special struct as a workaround.
export type SQLiteNullValue = {
  isNitroSQLiteNull: true
}
export type SQLiteValue =
  | boolean
  | number
  | string
  | ArrayBuffer
  | SQLiteNullValue
export type NativeSQLiteQueryParams = SQLiteValue[]

/**
 * Represents a value that can be stored in a SQLite database
 */
export type SQLiteQueryParamItem = SQLiteValue | null | undefined
export type SQLiteQueryParams = SQLiteQueryParamItem[]

export type QueryResultRowItem = SQLiteValue | undefined
export type QueryResultRow = Record<string, QueryResultRowItem>
export interface QueryResult<Row extends QueryResultRow = QueryResultRow> {
  readonly insertId?: number
  readonly rowsAffected: number

  readonly rows?: {
    /** Raw array with all dataset */
    _array: Row[]
    /** The lengh of the dataset */
    length: number
    /** A convenience function to acess the index based the row object
     * @param idx the row index
     * @returns the row structure identified by column names
     */
    item: (idx: number) => Row | undefined
  }
}

export type ExecuteQuery = <Row extends QueryResultRow = QueryResultRow>(
  query: string,
  params?: SQLiteQueryParams
) => QueryResult<Row>

export type ExecuteAsyncQuery = <Row extends QueryResultRow = QueryResultRow>(
  query: string,
  params?: SQLiteQueryParams
) => Promise<QueryResult<Row>>

export interface Transaction {
  commit(): QueryResult
  rollback(): QueryResult
  execute: ExecuteQuery
  executeAsync: ExecuteAsyncQuery
}

/**
 * Allows the execution of bulk of sql commands
 * inside a transaction
 * If a single query must be executed many times with different arguments, its preferred
 * to declare it a single time, and use an array of array parameters.
 */
export interface BatchQueryCommand {
  query: string
  params?: SQLiteQueryParams | SQLiteQueryParams[]
}

/**
 * status: 0 or undefined for correct execution, 1 for error
 * message: if status === 1, here you will find error description
 * rowsAffected: Number of affected rows if status == 0
 */
export interface BatchQueryResult {
  rowsAffected?: number
}

/**
 * Result of loading a file and executing every line as a SQL command
 * Similar to BatchQueryResult
 */
export interface FileLoadResult extends BatchQueryResult {
  commands?: number
}
