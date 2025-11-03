import { SQLiteNullValue, SQLiteValue } from './types'
import { SQLiteQueryParamItem } from './types'

let ENABLE_SIMPLE_NULL_HANDLING = false

export function enableSimpleNullHandling(
  shouldEnableSimpleNullHandling = true,
) {
  ENABLE_SIMPLE_NULL_HANDLING = shouldEnableSimpleNullHandling
}

export function isSimpleNullHandlingEnabled() {
  return ENABLE_SIMPLE_NULL_HANDLING
}

export const NITRO_SQLITE_NULL: SQLiteNullValue = { isNitroSQLiteNull: true }
export function isNitroSQLiteNull(value: unknown): value is SQLiteNullValue {
  if (
    value !== null &&
    typeof value === 'object' &&
    'isNitroSQLiteNull' in value
  ) {
    return true
  }
  return false
}

export function replaceWithNativeNullValue(
  value: SQLiteQueryParamItem,
): SQLiteValue {
  if (value === undefined || value === null) {
    return NITRO_SQLITE_NULL
  }
  return value
}
