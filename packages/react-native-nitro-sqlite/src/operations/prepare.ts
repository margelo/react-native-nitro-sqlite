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
