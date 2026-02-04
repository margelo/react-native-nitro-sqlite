import type {
  NitroSQLiteQueryColumnMetadata,
  NitroSQLiteQueryResult,
  NitroSQLiteQueryResultRows,
} from './specs/NitroSQLiteQueryResult.nitro'

export interface NitroSQLiteConnectionOptions {
  name: string
  location?: string
}

export interface NitroSQLiteConnection {
  close(): void
  delete(): void
  attach(dbNameToAttach: string, alias: string, location?: string): void
  detach(alias: string): void
  transaction: <Result = void>(
    transactionCallback: (tx: Transaction) => Promise<Result>,
  ) => Promise<Result>
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

export type SQLiteValue = boolean | number | string | ArrayBuffer | null

export type SQLiteQueryParams = SQLiteValue[]

export type QueryResultRow = Record<string, SQLiteValue>

export type QueryResult<Row extends QueryResultRow = QueryResultRow> =
  NitroSQLiteQueryResult & {
    readonly rowsAffected: number
    readonly insertId?: number

    /** Query results */
    readonly results: Row[]

    /** Query results in a row format for TypeORM compatibility */
    readonly rows?: NitroSQLiteQueryResultRows<Row>

    /** Table metadata */
    readonly metadata?: Record<string, NitroSQLiteQueryColumnMetadata>
  }

export type ExecuteQuery = <Row extends QueryResultRow = QueryResultRow>(
  query: string,
  params?: SQLiteValue[],
) => QueryResult<Row>

export type ExecuteAsyncQuery = <Row extends QueryResultRow = QueryResultRow>(
  query: string,
  params?: SQLiteQueryParams,
) => Promise<QueryResult<Row>>

export interface Transaction {
  commit(): NitroSQLiteQueryResult
  rollback(): NitroSQLiteQueryResult
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
