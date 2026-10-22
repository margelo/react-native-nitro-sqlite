import {
  createTableRelationsHelpers,
  DefaultLogger,
  entityKind,
  extractTablesRelationalConfig,
} from 'drizzle-orm'
import type {
  DrizzleConfig,
  RelationalSchemaConfig,
  TablesRelationalConfig,
} from 'drizzle-orm'
import { BaseSQLiteDatabase, SQLiteAsyncDialect } from 'drizzle-orm/sqlite-core'
import type {
  NitroSQLiteConnection,
  NitroSQLiteRawQueryResult,
} from 'react-native-nitro-sqlite'
import { NitroSQLiteSession } from './session'

/**
 * Asynchronous Drizzle database backed by an open Nitro SQLite connection.
 * Create it with {@link drizzle}; queries and prepared queries remain usable
 * until you close the connection. The database does not own or close it.
 * Use the callback's transaction handle for every query inside a transaction.
 * @typeParam TSchema Tables and relations supplied in the Drizzle configuration.
 */
export class NitroSQLiteDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> extends BaseSQLiteDatabase<'async', NitroSQLiteRawQueryResult, TSchema> {
  /** @internal Drizzle entity discriminator. */
  static override readonly [entityKind]: string = 'NitroSQLiteDatabase'

  /** Connection attached by {@link drizzle}. Close it after all queries finish. */
  $client?: NitroSQLiteConnection
}

/**
 * Create a Drizzle database whose queries run asynchronously on a Nitro SQLite connection.
 * Creating the wrapper does not open, migrate, or close the connection.
 * @typeParam TSchema Tables and relations supplied in `config.schema`.
 * @param connection Connection returned by `open()`.
 * @param config Drizzle options such as `schema`, `logger`, and `casing`.
 * @returns A database whose `$client` is the supplied connection.
 * @throws If Drizzle cannot read the supplied schema configuration.
 * Query promises reject on binding, SQLite, or closed-connection errors.
 */
export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  connection: NitroSQLiteConnection,
  config: DrizzleConfig<TSchema> = {},
): NitroSQLiteDatabase<TSchema> & { $client: NitroSQLiteConnection } {
  const dialect = new SQLiteAsyncDialect({ casing: config.casing })
  let logger
  if (config.logger === true) {
    logger = new DefaultLogger()
  } else if (config.logger !== false) {
    logger = config.logger
  }

  let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined
  if (config.schema) {
    const tablesConfig = extractTablesRelationalConfig(
      config.schema,
      createTableRelationsHelpers,
    )
    schema = {
      fullSchema: config.schema,
      schema: tablesConfig.tables,
      tableNamesMap: tablesConfig.tableNamesMap,
    }
  }

  const session = new NitroSQLiteSession(
    connection,
    connection,
    dialect,
    schema,
    { logger },
  )
  const db = new NitroSQLiteDatabase(
    'async',
    dialect,
    session,
    schema,
  ) as NitroSQLiteDatabase<TSchema>
  return Object.assign(db, { $client: connection })
}
