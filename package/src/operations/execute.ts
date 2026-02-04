import { HybridNitroSQLite } from '../nitro'
import type { NitroSQLiteQueryResult } from '../specs/NitroSQLiteQueryResult.nitro'
import type { QueryResult, QueryResultRow, SQLiteQueryParams } from '../types'
import NitroSQLiteError from '../NitroSQLiteError'

export function execute<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): QueryResult<Row> {
  try {
    const result = HybridNitroSQLite.execute(dbName, query, params)
    return buildJsQueryResult<Row>(result)
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}

export async function executeAsync<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): Promise<QueryResult<Row>> {
  try {
    const result = await HybridNitroSQLite.executeAsync(dbName, query, params)
    return buildJsQueryResult<Row>(result)
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}

function buildJsQueryResult<Row extends QueryResultRow = never>(
  result: NitroSQLiteQueryResult,
): QueryResult<Row> {
  const data = result.results as Row[]

  return {
    ...result,
    insertId: result.insertId,
    rowsAffected: result.rowsAffected,
    rows: {
      _array: data,
      length: data.length,
      item: (idx: number) => data[idx],
    },
  } as QueryResult<Row>
}
