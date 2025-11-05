import { Chance } from 'chance'
import { enableSimpleNullHandling } from 'react-native-nitro-sqlite'
import { resetTestDb } from '../db'
import chai from 'chai'

export function isError(e: unknown): e is Error {
  return e instanceof Error
}

export const expect = chai.expect
export const chance = new Chance()

export function setupTestDb() {
  enableSimpleNullHandling(false)
  resetTestDb()
}
