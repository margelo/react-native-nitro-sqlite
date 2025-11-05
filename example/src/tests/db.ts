import Chance from 'chance'
import type {
  NitroSQLiteConnection,
  BatchQueryCommand,
} from 'react-native-nitro-sqlite'
import { open } from 'react-native-nitro-sqlite'
import {
  getDatabaseQueue,
  type DatabaseQueue,
} from '../../../package/src/DatabaseQueue'

const chance = new Chance()

export const TEST_DB_NAME = 'test'

export let testDb: NitroSQLiteConnection
export let testDbQueue: DatabaseQueue
export function resetTestDb() {
  try {
    if (testDb != null) {
      testDb.close()
      testDb.delete()
    }

    testDb = open({
      name: TEST_DB_NAME,
    })
    testDbQueue = getDatabaseQueue(TEST_DB_NAME)

    testDb.execute('DROP TABLE IF EXISTS User;')
    testDb.execute(
      'CREATE TABLE User ( id REAL PRIMARY KEY, name TEXT NOT NULL, age REAL, networth REAL) STRICT;',
    )
  } catch (e) {
    console.warn('Error resetting user database', e)
  }
}

const LARGE_DB_NAME = 'large'

// Copyright 2024 Oscar Franco
// Taken from "op-sqlite" example project.
// Used to demonstrate the performance of NitroSQLite.
const ROWS = 300000
export let largeDb: NitroSQLiteConnection | undefined
export function resetLargeDb() {
  try {
    if (largeDb != null) {
      largeDb.close()
      largeDb.delete()
    }
    largeDb = open({
      name: LARGE_DB_NAME,
    })

    largeDb.execute(
      'CREATE TABLE Test ( id INT PRIMARY KEY, v1 TEXT, v2 TEXT, v3 TEXT, v4 TEXT, v5 TEXT, v6 INT, v7 INT, v8 INT, v9 INT, v10 INT, v11 REAL, v12 REAL, v13 REAL, v14 REAL) STRICT;',
    )

    largeDb.execute('PRAGMA mmap_size=268435456')

    const insertions: BatchQueryCommand[] = []
    for (let i = 0; i < ROWS; i++) {
      insertions.push({
        query:
          'INSERT INTO "Test" (id, v1, v2, v3, v4, v5, v6, v7, v8, v9, v10, v11, v12, v13, v14) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params: [
          i,
          chance.name(),
          chance.name(),
          chance.name(),
          chance.name(),
          chance.name(),
          chance.integer(),
          chance.integer(),
          chance.integer(),
          chance.integer(),
          chance.integer(),
          chance.floating(),
          chance.floating(),
          chance.floating(),
          chance.floating(),
        ],
      })
    }

    largeDb.executeBatch(insertions)
  } catch (e) {
    console.warn('Error resetting user database', e)
  }
}
