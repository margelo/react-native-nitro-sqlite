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

export class NitroSQLiteDatabase<
  TSchema extends Record<string, unknown> = Record<string, never>,
> extends BaseSQLiteDatabase<'async', NitroSQLiteRawQueryResult, TSchema> {
  static override readonly [entityKind]: string = 'NitroSQLiteDatabase'
}

/**
 * Create a Drizzle database whose queries run asynchronously on a Nitro SQLite connection.
 * @param connection Connection returned by `open()`.
 * @param config Drizzle options such as `schema`, `logger`, and `casing`.
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
