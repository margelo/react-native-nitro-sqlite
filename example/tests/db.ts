import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import { open } from 'react-native-nitro-sqlite'
import {
  getDatabaseQueue,
  type DatabaseQueue,
} from '@nitro-sqlite/DatabaseQueue'

export const TEST_DB_NAME = 'test'

export let testDb: NitroSQLiteConnection
export let testDbQueue: DatabaseQueue
export function resetTestDb() {
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
}

export function createArrayBufferTestDb(name: string) {
  // Use a dedicated database so ArrayBuffer tests do not interfere
  // with the default test database used in other specs.
  const db = open({ name })

  db.execute('DROP TABLE IF EXISTS BlobData;')
  db.execute(
    'CREATE TABLE BlobData (id INTEGER PRIMARY KEY, data BLOB NOT NULL) STRICT;',
  )

  return db
}
