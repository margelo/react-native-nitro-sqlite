import { NITRO_SQLITE_NULL } from '..'
import { HybridNitroSQLite } from '../nitro'
import type { NativeQueryResult } from '../specs/NativeQueryResult.nitro'
import type {
  QueryResult,
  NativeSQLiteQueryParams,
  SQLiteQueryParams,
  QueryResultRow,
} from '../types'

export function execute<Data extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams
): QueryResult<Data> {
  const nativeResult = HybridNitroSQLite.execute(
    dbName,
    query,
    toNativeQueryParams(params)
  )
  const result = buildJsQueryResult<Data>(nativeResult)
  return result
}

export async function executeAsync<Data extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams
): Promise<QueryResult<Data>> {
  const nativeResult = await HybridNitroSQLite.executeAsync(
    dbName,
    query,
    toNativeQueryParams(params)
  )
  const result = buildJsQueryResult<Data>(nativeResult)
  return result
}

function toNativeQueryParams(
  params: SQLiteQueryParams | undefined
): NativeSQLiteQueryParams | undefined {
  return params?.map((param) => {
    if (param === undefined || param === null) {
      return NITRO_SQLITE_NULL
    }
    return param
  })
}

function buildJsQueryResult<Data extends QueryResultRow = never>({
  insertId,
  rowsAffected,
  results,
}: NativeQueryResult): QueryResult<Data> {
  const data = results.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (value === NITRO_SQLITE_NULL) {
          return [key, undefined]
        }
        return [key, value]
      })
    )
  ) as Data[]

  return {
    insertId,
    rowsAffected,
    rows: {
      _array: data,
      length: data.length,
      item: (idx: number) => data[idx],
    },
  }
}
