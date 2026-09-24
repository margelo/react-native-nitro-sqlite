import { HybridNitroSQLite } from '../nitro'
import NitroSQLiteError from '../NitroSQLiteError'
import type {
  PreparedStatement,
  QueryResult,
  QueryResultRow,
  SQLiteQueryParams,
} from '../types'
import { buildJSQueryResult } from './execute'
import { queueOperationAsync, startOperationSync } from '../DatabaseQueue'
import type { DatabaseQueueKey } from '../DatabaseQueue'

/**
 * Prepare one SQL statement on an open managed connection for repeated execution.
 * Synchronous preparation throws if the connection is busy. Finalize the returned
 * statement before closing the connection.
 * @param dbName Database name or independent connection ID.
 * @param query SQL statement with optional positional placeholders.
 * @param queueKey Internal managed queue key; omit when using the public API.
 * @returns A statement whose executions use the same connection queue.
 */
export function prepare(
  dbName: string,
  query: string,
  queueKey: DatabaseQueueKey = dbName,
): PreparedStatement {
  try {
    const nativeStatement = startOperationSync(queueKey, () =>
      HybridNitroSQLite.prepare(dbName, query),
    )

    return {
      get isFinalized() {
        return nativeStatement.isFinalized
      },
      execute: <Row extends QueryResultRow = QueryResultRow>(
        params?: SQLiteQueryParams,
      ): QueryResult<Row> => {
        try {
          return startOperationSync(queueKey, () =>
            buildJSQueryResult(nativeStatement.execute(params)),
          )
        } catch (error) {
          throw NitroSQLiteError.fromError(error)
        }
      },
      executeAsync: async <Row extends QueryResultRow = QueryResultRow>(
        params?: SQLiteQueryParams,
      ): Promise<QueryResult<Row>> => {
        try {
          return await queueOperationAsync(queueKey, async () =>
            buildJSQueryResult(await nativeStatement.executeAsync(params)),
          )
        } catch (error) {
          throw NitroSQLiteError.fromError(error)
        }
      },
      finalize: () => {
        try {
          startOperationSync(queueKey, () => nativeStatement.finalize())
        } catch (error) {
          throw NitroSQLiteError.fromError(error)
        }
      },
    }
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}
