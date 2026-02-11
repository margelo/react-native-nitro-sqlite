import { HybridNitroSQLite } from '../nitro'
import type { QueryResult, QueryResultRow, SQLiteQueryParams } from '../types'
import NitroSQLiteError from '../NitroSQLiteError'
import type { NitroSQLiteQueryResult } from '../specs/NitroSQLiteQueryResult.nitro'

export function execute<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams,
): QueryResult<Row> {
  try {
    const nativeResult = HybridNitroSQLite.execute(dbName, query, params)
    return buildJSQueryResult<Row>(nativeResult)
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
    const nativeResult = await HybridNitroSQLite.executeAsync(
      dbName,
      query,
      params,
    )
    return buildJSQueryResult<Row>(nativeResult)
  } catch (error) {
    throw NitroSQLiteError.fromError(error)
  }
}

function buildJSQueryResult<Row extends QueryResultRow = never>(
  result: NitroSQLiteQueryResult,
): QueryResult<Row> {
  const resultWithRows = result as QueryResult<Row>

  resultWithRows.rows = {
    _array: result.results as Row[],
    length: result.results.length,
    item: (idx: number) => result.results[idx] as Row | undefined,
  }

  return resultWithRows

  // return Object.assign(result, {
  //   rows: {
  //     _array: result.results,
  //     length: result.results.length,
  //     item: (idx: number) => result.results[idx],
  //   },
  // })
}
