import { HybridNitroSQLite } from '../nitro'
import NitroSQLiteError from '../NitroSQLiteError'
import type {
  PreparedStatement,
  QueryResult,
  QueryResultRow,
  SQLiteQueryParams,
} from '../types'
import { buildJSQueryResult } from './execute'

export function prepare(dbName: string, query: string): PreparedStatement {
  try {
    const nativeStatement = HybridNitroSQLite.prepare(dbName, query)

    return {
      get isFinalized() {
        return nativeStatement.isFinalized
      },
      execute: <Row extends QueryResultRow = QueryResultRow>(
        params?: SQLiteQueryParams,
      ): QueryResult<Row> => {
        try {
          return buildJSQueryResult(nativeStatement.execute(params))
        } catch (error) {
          throw NitroSQLiteError.fromError(error)
        }
      },
      executeAsync: async <Row extends QueryResultRow = QueryResultRow>(
        params?: SQLiteQueryParams,
      ): Promise<QueryResult<Row>> => {
        try {
          return buildJSQueryResult(await nativeStatement.executeAsync(params))
        } catch (error) {
          throw NitroSQLiteError.fromError(error)
        }
      },
      finalize: () => {
        try {
          nativeStatement.finalize()
        } catch (error) {
          throw NitroSQLiteError.fromError(error)
        }
      },
    }
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}
