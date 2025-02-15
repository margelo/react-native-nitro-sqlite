//   _________     _______  ______ ____  _____  __  __            _____ _____
//  |__   __\ \   / /  __ \|  ____/ __ \|  __ \|  \/  |     /\   |  __ \_   _|
//     | |   \ \_/ /| |__) | |__ | |  | | |__) | \  / |    /  \  | |__) || |
//     | |    \   / |  ___/|  __|| |  | |  _  /| |\/| |   / /\ \ |  ___/ | |
//     | |     | |  | |    | |___| |__| | | \ \| |  | |  / ____ \| |    _| |_
//     |_|     |_|  |_|    |______\____/|_|  \_\_|  |_| /_/    \_\_|   |_____|

import type {
  QueryResult,
  Transaction,
  SQLiteQueryParams,
  QueryResultRow,
} from './types'
import * as Operations from './operations/session'

interface TypeOrmNitroSQLiteConnection {
  executeSql: <RowData extends QueryResultRow = never>(
    sql: string,
    params: SQLiteQueryParams | undefined,
    okExecute: (res: QueryResult<RowData>) => void,
    failExecute: (msg: string) => void
  ) => Promise<void>
  transaction: (fn: (tx: Transaction) => Promise<void>) => Promise<void>
  close: (okClose: () => void, failClose: (e: unknown) => void) => void
  attach: (
    dbNameToAttach: string,
    alias: string,
    location: string | undefined,
    callback: () => void
  ) => void
  detach: (alias: string, callback: () => void) => void
}

/**
 * DO NOT USE THIS! THIS IS MEANT FOR TYPEORM
 * If you are looking for a convenience wrapper use `connect`
 */
export const typeORMDriver = {
  openDatabase: (
    options: {
      name: string
      location?: string
    },
    ok: (db: TypeOrmNitroSQLiteConnection) => void,
    fail: (msg: string) => void
  ): TypeOrmNitroSQLiteConnection | null => {
    try {
      const db = Operations.open(options)

      const connection: TypeOrmNitroSQLiteConnection = {
        executeSql: async <RowData extends QueryResultRow = never>(
          sql: string,
          params: SQLiteQueryParams | undefined,
          okExecute: (res: QueryResult<RowData>) => void,
          failExecute: (msg: string) => void
        ) => {
          try {
            const result = await db.executeAsync<RowData>(sql, params)
            okExecute(result)
          } catch (e: unknown) {
            failExecute(e as string)
          }
        },
        transaction: (
          fn: (tx: Transaction) => Promise<void>
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
          callback: () => void
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
