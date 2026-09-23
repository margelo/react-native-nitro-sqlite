//   _________     _______  ______ ____  _____  __  __            _____ _____
//  |__   __\ \   / /  __ \|  ____/ __ \|  __ \|  \/  |     /\   |  __ \_   _|
//     | |   \ \_/ /| |__) | |__ | |  | | |__) | \  / |    /  \  | |__) || |
//     | |    \   / |  ___/|  __|| |  | |  _  /| |\/| |   / /\ \ |  ___/ | |
//     | |     | |  | |    | |___| |__| | | \ \| |  | |  / ____ \| |    _| |_
//     |_|     |_|  |_|    |______\____/|_|  \_\_|  |_| /_/    \_\_|   |_____|

import type {
  Transaction,
  SQLiteQueryParams,
  QueryResultRow,
  QueryResult,
} from './types'
import * as Operations from './operations/session'

/** Callback-oriented connection returned to TypeORM. */
export interface TypeOrmNitroSQLiteConnection {
  /** Execute SQL asynchronously and report the result through a callback. */
  executeSql: <RowData extends QueryResultRow = never>(
    sql: string,
    params: SQLiteQueryParams | undefined,
    okExecute: (res: QueryResult<RowData>) => void,
    failExecute: (msg: string) => void,
  ) => Promise<void>
  /** Run TypeORM work in a managed transaction. */
  transaction: (fn: (tx: Transaction) => Promise<void>) => Promise<void>
  /** Close the connection and report completion through callbacks. */
  close: (okClose: () => void, failClose: (e: unknown) => void) => void
  /** Attach another database and invoke `callback` after it succeeds. */
  attach: (
    dbNameToAttach: string,
    alias: string,
    location: string | undefined,
    callback: () => void,
  ) => void
  /** Detach an attached database and invoke `callback` after it succeeds. */
  detach: (alias: string, callback: () => void) => void
}

/** Adapter for TypeORM's React Native driver. Application code should use `open()`.
 * `openDatabase` reports success or failure through callbacks and returns the
 * connection on success, or `null` when opening fails.
 */
export const typeORMDriver = {
  /** Open a database for TypeORM.
   * @param options Database name and optional relative directory.
   * @param ok Receives the adapter connection on success.
   * @param fail Receives the opening error on failure.
   */
  openDatabase: (
    options: {
      name: string
      location?: string
    },
    ok: (db: TypeOrmNitroSQLiteConnection) => void,
    fail: (msg: string) => void,
  ): TypeOrmNitroSQLiteConnection | null => {
    try {
      const db = Operations.open(options)

      const connection: TypeOrmNitroSQLiteConnection = {
        executeSql: async <RowData extends QueryResultRow = never>(
          sql: string,
          params: SQLiteQueryParams | undefined,
          okExecute: (res: QueryResult<RowData>) => void,
          failExecute: (msg: string) => void,
        ) => {
          try {
            const result = await db.executeAsync<RowData>(sql, params)
            okExecute(result)
          } catch (e: unknown) {
            failExecute(e as string)
          }
        },
        transaction: (
          fn: (tx: Transaction) => Promise<void>,
        ): Promise<void> => {
          return db.transaction(fn)
        },
        close: (okClose: () => void, failClose: (e: unknown) => void) => {
          try {
            db.close()
            okClose()
          } catch (e) {
            failClose(e)
          }
        },
        attach: (
          dbNameToAttach: string,
          alias: string,
          location: string | undefined,
          callback: () => void,
        ) => {
          db.attach(dbNameToAttach, alias, location)
          callback()
        },
        detach: (alias: string, callback: () => void) => {
          db.detach(alias)
          callback()
        },
      }

      ok(connection)

      return connection
    } catch (e: unknown) {
      fail(e as string)

      return null
    }
  },
}
