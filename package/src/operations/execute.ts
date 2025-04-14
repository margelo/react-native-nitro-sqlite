import { isNitroSQLiteNull, isSimpleNullHandlingEnabled } from '../nullHandling'
import { HybridNitroSQLite } from '../nitro'
import { replaceWithNativeNullValue } from '../nullHandling'
import type { NativeQueryResult } from '../specs/NativeQueryResult.nitro'
import type {
  QueryResult,
  NativeSQLiteQueryParams,
  SQLiteQueryParams,
  QueryResultRow,
} from '../types'

export function execute<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams
): QueryResult<Row> {
  const transformedParams = isSimpleNullHandlingEnabled()
    ? toNativeQueryParams(params)
    : (params as NativeSQLiteQueryParams)

  const nativeResult = HybridNitroSQLite.execute(
    dbName,
    query,
    transformedParams
  )
  const result = buildJsQueryResult<Row>(nativeResult)
  return result
}

export async function executeAsync<Row extends QueryResultRow = never>(
  dbName: string,
  query: string,
  params?: SQLiteQueryParams
): Promise<QueryResult<Row>> {
  const transformedParams = isSimpleNullHandlingEnabled()
    ? toNativeQueryParams(params)
    : (params as NativeSQLiteQueryParams)

  const nativeResult = await HybridNitroSQLite.executeAsync(
    dbName,
    query,
    transformedParams
  )
  const result = buildJsQueryResult<Row>(nativeResult)
  return result
}

function toNativeQueryParams(
  params: SQLiteQueryParams | undefined
): NativeSQLiteQueryParams | undefined {
  return params?.map((param) => replaceWithNativeNullValue(param))
}

function buildJsQueryResult<Row extends QueryResultRow = never>({
  insertId,
  rowsAffected,
  results,
}: NativeQueryResult): QueryResult<Row> {
  let data: Row[] = results as Row[]

  if (isSimpleNullHandlingEnabled()) {
    data = results.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => {
          if (isNitroSQLiteNull(value)) {
            return [key, null]
          }
          return [key, value]
        })
      )
    ) as Row[]
  }

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
