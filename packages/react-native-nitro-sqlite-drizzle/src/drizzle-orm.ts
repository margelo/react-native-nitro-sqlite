// drizzle-orm 0.45 ships these at runtime but marks them internal, so its type declarations omit them.
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-shadow -- merged declarations must repeat drizzle-orm's type parameters */
import type {
  AnyColumn,
  ExtractTablesWithRelations,
  SelectedFieldsOrdered,
  TablesRelationalConfig,
} from 'drizzle-orm'
import type {
  SQLiteAsyncDialect,
  SQLiteSession,
  SQLiteSyncDialect,
} from 'drizzle-orm/sqlite-core'

declare module 'drizzle-orm/utils' {
  export function mapResultRow<TResult>(
    columns: SelectedFieldsOrdered<AnyColumn>,
    row: unknown[],
    joinsNotNullableMap: Record<string, boolean> | undefined,
  ): TResult
}

declare module 'drizzle-orm/sqlite-core/session' {
  interface SQLitePreparedQuery<T extends PreparedQueryConfig> {
    joinsNotNullableMap?: Record<string, boolean>
  }

  interface SQLiteSession<
    TResultKind extends 'sync' | 'async',
    TRunResult,
    TFullSchema extends Record<string, unknown>,
    TSchema extends TablesRelationalConfig,
  > {
    readonly dialect: {
      sync: SQLiteSyncDialect
      async: SQLiteAsyncDialect
    }[TResultKind]
  }
}

declare module 'drizzle-orm/sqlite-core/db' {
  interface BaseSQLiteDatabase<
    TResultKind extends 'sync' | 'async',
    TRunResult,
    TFullSchema extends Record<string, unknown> = Record<string, never>,
    TSchema extends
      TablesRelationalConfig = ExtractTablesWithRelations<TFullSchema>,
  > {
    readonly dialect: {
      sync: SQLiteSyncDialect
      async: SQLiteAsyncDialect
    }[TResultKind]
    readonly session: SQLiteSession<
      TResultKind,
      TRunResult,
      TFullSchema,
      TSchema
    >
  }
}
