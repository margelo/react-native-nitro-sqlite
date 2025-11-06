import { Chance } from 'chance'
import {
  enableSimpleNullHandling,
  NitroSQLiteError,
} from 'react-native-nitro-sqlite'
import { resetTestDb } from '../db'
import chai from 'chai'

export function isNitroSQLiteError(e: unknown): e is NitroSQLiteError {
  return e instanceof NitroSQLiteError
}

export const expect = chai.expect
export const chance = new Chance()

export function setupTestDb() {
  enableSimpleNullHandling(false)
  resetTestDb()
}
