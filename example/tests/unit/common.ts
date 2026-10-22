import { Chance } from 'chance'
import { SQLiteError } from 'react-native-nitro-sqlite'
import { resetTestDb } from '@tests/db'
export { expect } from '@tests/TestApi'

export const TEST_ERROR_CODES = {
  EXPECT_NITRO_SQLITE_ERROR: 'Should have thrown a valid SQLiteError',
  EXPECT_PROMISE_REJECTION: 'Should have thrown a promise rejection',
} as const

export const TEST_ERROR_MESSAGE = 'Error from callback'
export const TEST_ERROR = new Error(TEST_ERROR_MESSAGE)

export function isSQLiteError(e: unknown): e is SQLiteError {
  return e instanceof SQLiteError
}

export const chance = new Chance()

export function setupTestDb() {
  resetTestDb()
}
