import { Chance } from 'chance'
import {
  enableSimpleNullHandling,
  NitroSQLiteError,
} from 'react-native-nitro-sqlite'
import { resetTestDb } from '../db'
import chai from 'chai'

export const TEST_ERROR_CODES = {
  EXPECT_NITRO_SQLITE_ERROR: 'Should have thrown a valid NitroSQLiteError',
  EXPECT_PROMISE_REJECTION: 'Should have thrown a promise rejection',
} as const

export const TEST_ERROR_MESSAGE = 'Error from callback'
export const TEST_ERROR = new Error(TEST_ERROR_MESSAGE)

export function isNitroSQLiteError(e: unknown): e is NitroSQLiteError {
  return e instanceof NitroSQLiteError
}

export const expect = chai.expect
export const chance = new Chance()

export function setupTestDb() {
  enableSimpleNullHandling(false)
  resetTestDb()
}
