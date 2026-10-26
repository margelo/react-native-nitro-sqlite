import { entityKind, fillPlaceholders, NoopLogger, sql } from 'drizzle-orm'
import type {
  Logger,
  Query,
  RelationalSchemaConfig,
  TablesRelationalConfig,
} from 'drizzle-orm'
import {
  SQLitePreparedQuery,
  SQLiteSession,
  SQLiteTransaction,
} from 'drizzle-orm/sqlite-core'
import type {
  PreparedQueryConfig,
  SelectedFieldsOrdered,
  SQLiteAsyncDialect,
  SQLiteExecuteMethod,
  SQLiteTransactionConfig,
} from 'drizzle-orm/sqlite-core'
import { mapResultRow } from 'drizzle-orm/utils'
import type {
  NitroSQLiteConnection,
  NitroSQLiteRawQueryResult,
  SQLiteQueryParams,
  Transaction,
} from 'react-native-nitro-sqlite'
import './drizzle-orm'

/** Logging configuration shared by a session and its transactions. */
export interface NitroSQLiteSessionOptions {
  /** Receives SQL and bound parameters before execution. Omit to disable logging. */
  logger?: Logger
}

/**
 * Executes Drizzle queries through a Nitro SQLite connection or transaction.
 * {@link drizzle} creates sessions for normal use. A session does not close its
 * connection; a transaction-bound session is usable only within its callback.
 * @typeParam TFullSchema Full schema object supplied to Drizzle.
 * @typeParam TSchema Relational table configuration extracted from that schema.
 */
export class NitroSQLiteSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteSession<
  'async',
  NitroSQLiteRawQueryResult,
  TFullSchema,
  TSchema
> {
  /** @internal Drizzle entity discriminator. */
  static override readonly [entityKind]: string = 'NitroSQLiteSession'

  private logger: Logger

  /**
   * Bind a session to an existing connection or active transaction.
   * @param connection Open connection used to start managed transactions.
   * @param client The connection, or the active transaction used for queries.
   * @param dialect Asynchronous SQLite dialect used to compile queries.
   * @param schema Relational schema configuration, or `undefined` when none was supplied.
   * @param options Query logging options, inherited by transactions.
   */
  constructor(
    private connection: NitroSQLiteConnection,
    // The connection, or the transaction handle while a transaction runs.
    private client: NitroSQLiteConnection | Transaction,
    dialect: SQLiteAsyncDialect,
    private schema: RelationalSchemaConfig<TSchema> | undefined,
    private options: NitroSQLiteSessionOptions = {},
  ) {
    super(dialect)
    this.logger = options.logger ?? new NoopLogger()
  }

  /**
   * Create a reusable query wrapper without preparing a native SQLite statement.
   * @typeParam T Result types for the query's execution methods.
   * @param query Compiled SQL and positional parameters, including placeholders.
   * @param fields Ordered selected fields used to decode result rows.
   * @param executeMethod Method invoked by the wrapper's `execute()` call.
   * @param isResponseInArrayMode Whether Drizzle expects positional rows.
   * @param customResultMapper Optional decoder for relational query results.
   * @returns A wrapper bound to this session's client. It needs no disposal.
   */
  prepareQuery<T extends PreparedQueryConfig & { type: 'async' }>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    isResponseInArrayMode: boolean,
    customResultMapper?: (rows: unknown[][]) => unknown,
  ): NitroSQLitePreparedQuery<T> {
    return new NitroSQLitePreparedQuery(
      this.client,
      query,
      this.logger,
      fields,
      executeMethod,
      isResponseInArrayMode,
      customResultMapper,
    )
  }

  /**
   * Hold the connection until an asynchronous transaction callback finishes.
   * Await every query through `tx`; awaiting queries through the outer database
   * waits for this transaction and deadlocks the callback.
   * @typeParam T Callback result type.
   * @param transaction Callback that commits on success and rolls back on failure.
   * @param _config Accepted for Drizzle compatibility. `behavior` is ignored;
   * the connection starts the transaction with `BEGIN`.
   * @returns The callback result after the transaction commits.
   * @throws Rejects with `NitroSQLiteError` on query, callback, or finalization failure.
   * An uncaught `tx.rollback()` rejects with the message `Rollback`.
   */
  override async transaction<T>(
    transaction: (
      tx: NitroSQLiteTransaction<TFullSchema, TSchema>,
    ) => Promise<T>,
    _config?: SQLiteTransactionConfig,
  ): Promise<T> {
    return this.connection.transaction(async (nitroTransaction) => {
      const session = new NitroSQLiteSession<TFullSchema, TSchema>(
        this.connection,
        nitroTransaction,
        this.dialect,
        this.schema,
        this.options,
      )
      const tx = new NitroSQLiteTransaction<TFullSchema, TSchema>(
        'async',
        this.dialect,
        session,
        this.schema,
      )
      return transaction(tx)
    })
  }
}

/**
 * Drizzle transaction handle supplied to a transaction callback.
 * Use it for queries and nested transactions only while the callback is active.
 * Inherited `rollback()` throws Drizzle's `TransactionRollbackError`; an error
 * escaping the outer callback becomes a `NitroSQLiteError` with message `Rollback`.
 * @typeParam TFullSchema Full schema object supplied to Drizzle.
 * @typeParam TSchema Relational table configuration extracted from that schema.
 */
export class NitroSQLiteTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteTransaction<
  'async',
  NitroSQLiteRawQueryResult,
  TFullSchema,
  TSchema
> {
  /** @internal Drizzle entity discriminator. */
  static override readonly [entityKind]: string = 'NitroSQLiteTransaction'

  /**
   * Run a nested transaction using a SQLite savepoint.
   * @typeParam T Nested callback result type.
   * @param transaction Callback whose changes roll back to the savepoint if it throws.
   * @returns The callback result after releasing the savepoint.
   * @throws Rejects with the callback error, or a query error if savepoint operations fail.
   * Catch the rejection in the outer callback to continue that transaction.
   */
  override async transaction<T>(
    transaction: (
      tx: NitroSQLiteTransaction<TFullSchema, TSchema>,
    ) => Promise<T>,
  ): Promise<T> {
    const savepointName = `sp${this.nestedIndex}`
    const tx = new NitroSQLiteTransaction<TFullSchema, TSchema>(
      'async',
      this.dialect,
      this.session,
      this.schema,
      this.nestedIndex + 1,
    )
    await this.session.run(sql.raw(`savepoint ${savepointName}`))
    try {
      const result = await transaction(tx)
      await this.session.run(sql.raw(`release savepoint ${savepointName}`))
      return result
    } catch (error) {
      await this.session.run(sql.raw(`rollback to savepoint ${savepointName}`))
      throw error
    }
  }
}

/**
 * Reusable compiled Drizzle query with asynchronous execution and row decoding.
 * Each execution binds fresh placeholder values. No native prepared statement is
 * retained, so no finalization is needed. A transaction-bound query must finish
 * before its callback returns; other queries require an open connection.
 * @typeParam T Result types supplied by Drizzle for each execution method.
 */
export class NitroSQLitePreparedQuery<
  T extends PreparedQueryConfig = PreparedQueryConfig,
> extends SQLitePreparedQuery<{
  type: 'async'
  run: NitroSQLiteRawQueryResult
  all: T['all']
  get: T['get']
  values: T['values']
  execute: T['execute']
}> {
  /** @internal Drizzle entity discriminator. */
  static override readonly [entityKind]: string = 'NitroSQLitePreparedQuery'

  /**
   * Create a query wrapper without executing SQL.
   * @param client Open connection or active transaction used for execution.
   * @param query Compiled SQL and positional parameters, including placeholders.
   * @param logger Receives each query before execution.
   * @param fields Ordered selected fields used to decode result rows.
   * @param executeMethod Method invoked by `execute()`.
   * @param _isResponseInArrayMode Whether Drizzle expects positional rows.
   * @param customResultMapper Optional decoder for relational query results.
   */
  constructor(
    private client: NitroSQLiteConnection | Transaction,
    query: Query,
    private logger: Logger,
    private fields: SelectedFieldsOrdered | undefined,
    executeMethod: SQLiteExecuteMethod,
    private _isResponseInArrayMode: boolean,
    private customResultMapper?: (rows: unknown[][]) => unknown,
  ) {
    super('async', executeMethod, query)
  }

  /**
   * Execute SQL and return Nitro SQLite's raw result, including affected rows.
   * @param placeholderValues Values for every named placeholder in the query.
   * @returns Raw positional rows, column names, and execution metadata.
   * @throws Rejects on missing placeholders, invalid bindings, SQLite errors,
   * or a closed connection or finalized transaction.
   */
  async run(
    placeholderValues?: Record<string, unknown>,
  ): Promise<NitroSQLiteRawQueryResult> {
    return this.client.executeRawAsync(
      this.query.sql,
      this.bindParams(placeholderValues),
    )
  }

  /**
   * Execute SQL and decode every row with the selected fields or custom mapper.
   * Without either, rows are objects keyed by SQLite column names.
   * @param placeholderValues Values for every named placeholder in the query.
   * @returns All decoded rows, or the custom mapper's result.
   * @throws Rejects on binding, query, or decoding errors, including an inactive client.
   */
  async all(placeholderValues?: Record<string, unknown>): Promise<T['all']> {
    const { fields, customResultMapper } = this
    if (!fields && !customResultMapper) {
      const result = await this.client.executeAsync(
        this.query.sql,
        this.bindParams(placeholderValues),
      )
      return result.results
    }

    const rows = (await this.values(placeholderValues)) as unknown[][]
    if (customResultMapper) {
      return customResultMapper(rows) as T['all']
    }
    return rows.map((row) =>
      mapResultRow(fields!, row, this.joinsNotNullableMap),
    )
  }

  /**
   * Execute SQL and decode its first row.
   * @param placeholderValues Values for every named placeholder in the query.
   * @returns The first decoded row, `undefined` if empty, or the custom mapper's result.
   * @throws Rejects on binding, query, or decoding errors, including an inactive client.
   */
  async get(placeholderValues?: Record<string, unknown>): Promise<T['get']> {
    const { fields, customResultMapper } = this
    if (!fields && !customResultMapper) {
      const result = await this.client.executeAsync(
        this.query.sql,
        this.bindParams(placeholderValues),
      )
      return result.results[0]
    }

    const rows = (await this.values(placeholderValues)) as unknown[][]
    const row = rows[0]
    if (!row) {
      return undefined
    }
    if (customResultMapper) {
      return customResultMapper(rows) as T['get']
    }
    return mapResultRow(fields!, row, this.joinsNotNullableMap)
  }

  /**
   * Execute SQL and return positional rows without Drizzle field decoding.
   * @param placeholderValues Values for every named placeholder in the query.
   * @returns Row arrays in SQLite's selected-column order.
   * @throws Rejects on binding or query errors, including an inactive client.
   */
  async values(
    placeholderValues?: Record<string, unknown>,
  ): Promise<T['values']> {
    const result = await this.client.executeRawAsync(
      this.query.sql,
      this.bindParams(placeholderValues),
    )
    return result.rows
  }

  /** @internal */
  isResponseInArrayMode(): boolean {
    return this._isResponseInArrayMode
  }

  private bindParams(
    placeholderValues: Record<string, unknown> | undefined,
  ): SQLiteQueryParams {
    const params = fillPlaceholders(
      this.query.params,
      placeholderValues ?? {},
    ).map((value) =>
      ArrayBuffer.isView(value)
        ? new Uint8Array(
            value.buffer,
            value.byteOffset,
            value.byteLength,
          ).slice().buffer
        : value,
    )
    this.logger.logQuery(this.query.sql, params)
    return params as SQLiteQueryParams
  }
}
