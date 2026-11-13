export type {
  /** @deprecated Use {@linkcode ConnectionOptions}. */
  ConnectionOptions as NitroSQLiteConnectionOptions,
  /** @deprecated Use {@linkcode Connection}. */
  Connection as NitroSQLiteConnection,
  /** @deprecated Use {@linkcode QueryResultRows}. */
  QueryResultRows as NitroSQLiteQueryResultRows,
} from './types'
export type {
  /** @deprecated Use {@linkcode NativeQueryResult}. */
  NativeQueryResult as NitroSQLiteQueryResult,
  /** @deprecated Use {@linkcode NativeQueryRows}. */
  NativeQueryRows as NitroSQLiteQueryRows,
  /** @deprecated Use {@linkcode QueryColumnMetadata}. */
  QueryColumnMetadata as NitroSQLiteQueryColumnMetadata,
} from './specs/NativeQueryResult'
export type {
  /** @deprecated Use {@linkcode NativePreparedStatement}. */
  PreparedStatement as NitroSQLitePreparedStatement,
} from './specs/PreparedStatement.nitro'
export type {
  /** @deprecated Use {@linkcode NativeSQLite}. */
  NitroSQLite as NitroSQLiteNative,
} from './specs/NitroSQLite.nitro'
export type {
  /** @deprecated Use {@linkcode TypeOrmConnection}. */
  TypeOrmConnection as TypeOrmNitroSQLiteConnection,
} from './typeORM'
