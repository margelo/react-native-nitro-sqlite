import { Chance } from 'chance'
import {
  NitroSQLiteConnection,
  enableSimpleNullHandling,
} from 'react-native-nitro-sqlite'
import { testDb as testDbInternal, resetTestDb } from '../db'
import chai from 'chai'

export function isError(e: unknown): e is Error {
  return e instanceof Error
}

export const expect = chai.expect
export const chance = new Chance()

export let testDb: NitroSQLiteConnection

export function setupTestDb() {
  enableSimpleNullHandling(false)

  try {
    resetTestDb()

    if (testDbInternal == null) throw new Error('Failed to reset test database')

    testDbInternal.execute('DROP TABLE IF EXISTS User;')
    testDbInternal.execute(
      'CREATE TABLE User ( id REAL PRIMARY KEY, name TEXT NOT NULL, age REAL, networth REAL) STRICT;',
    )

    testDb = testDbInternal!
  } catch (e) {
    console.warn('Error resetting user database', e)
  }
}
