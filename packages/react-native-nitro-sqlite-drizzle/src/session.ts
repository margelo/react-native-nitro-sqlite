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

export interface NitroSQLiteSessionOptions {
  logger?: Logger
}

export class NitroSQLiteSession<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteSession<
  'async',
  NitroSQLiteRawQueryResult,
  TFullSchema,
  TSchema
> {
  static override readonly [entityKind]: string = 'NitroSQLiteSession'

  private logger: Logger

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

export class NitroSQLiteTransaction<
  TFullSchema extends Record<string, unknown>,
  TSchema extends TablesRelationalConfig,
> extends SQLiteTransaction<
  'async',
  NitroSQLiteRawQueryResult,
  TFullSchema,
  TSchema
> {
  static override readonly [entityKind]: string = 'NitroSQLiteTransaction'

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
  static override readonly [entityKind]: string = 'NitroSQLitePreparedQuery'

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

  async run(
    placeholderValues?: Record<string, unknown>,
  ): Promise<NitroSQLiteRawQueryResult> {
    return this.client.executeRawAsync(
      this.query.sql,
      this.bindParams(placeholderValues),
    )
  }

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
    const params = fillPlaceholders(this.query.params, placeholderValues ?? {})
    this.logger.logQuery(this.query.sql, params)
    return params as SQLiteQueryParams
  }
}
