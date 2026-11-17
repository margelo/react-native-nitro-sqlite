import { HybridNitroSQLite } from '../nitro'
import NitroSQLiteError from '../NitroSQLiteError'
import type {
  PreparedStatement,
  QueryResult,
  QueryResultRow,
  SQLiteQueryParams,
} from '../types'
import type { NitroSQLiteRawQueryResult } from '../specs/NitroSQLiteQueryResult.nitro'
import { buildJSQueryResult } from './execute'
import { rejectWithNitroSQLiteError } from '../nativePromise'
import { queueStatementAsync, startOperationSync } from '../DatabaseQueue'
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
      // Chained instead of `async`, which would add promise layers to every execution.
      // Native code runs executions on the connection's worker in call order, so they
      // queue as statements and several can be submitted without waiting for each result.
      executeAsync: <Row extends QueryResultRow = QueryResultRow>(
        params?: SQLiteQueryParams,
      ): Promise<QueryResult<Row>> =>
        queueStatementAsync(queueKey, () =>
          nativeStatement
            .executeAsync(params)
            .then((result) => buildJSQueryResult<Row>(result)),
        ).catch(rejectWithNitroSQLiteError),
      executeRaw: (params?: SQLiteQueryParams): NitroSQLiteRawQueryResult => {
        try {
          return startOperationSync(queueKey, () =>
            nativeStatement.executeRaw(params),
          )
        } catch (error) {
          throw NitroSQLiteError.fromError(error)
        }
      },
      executeRawAsync: (
        params?: SQLiteQueryParams,
      ): Promise<NitroSQLiteRawQueryResult> =>
        queueStatementAsync(queueKey, () =>
          nativeStatement.executeRawAsync(params),
        ).catch(rejectWithNitroSQLiteError),
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
