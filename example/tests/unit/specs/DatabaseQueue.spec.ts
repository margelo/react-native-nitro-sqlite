import {
  expect,
  isNitroSQLiteError,
  TEST_ERROR,
  TEST_ERROR_CODES,
  TEST_ERROR_MESSAGE,
} from '@tests/unit/common'
import { describe, it } from '@tests/TestApi'
import { testDb, testDbQueue } from '@tests/db'
import {
  NitroSQLite,
  NitroSQLiteError,
  open,
  type BatchQueryCommand,
} from 'react-native-nitro-sqlite'

const TEST_QUERY = 'SELECT * FROM [User];'

const TEST_BATCH_COMMANDS: BatchQueryCommand[] = [{ query: TEST_QUERY }]

function dropDatabaseIfExists(dbName: string, location?: string) {
  try {
    NitroSQLite.native.drop(dbName, location)
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('Database file not found')
    ) {
      return
    }
    throw error
  }
}

export default function registerDatabaseQueueUnitTests() {
  describe('Database Queue', () => {
    it('multiple transactions are queued', async () => {
      const transaction1Promise = testDb.transaction(async (tx) => {
        tx.execute(TEST_QUERY)

        expect(testDbQueue.queue.length).toBe(2)
        expect(testDbQueue.inProgress).toBe(true)

        await new Promise<void>((resolve) => setTimeout(resolve, 100))

        tx.execute(TEST_QUERY)

        expect(testDbQueue.queue.length).toBe(2)
        expect(testDbQueue.inProgress).toBe(true)
      })

      expect(testDbQueue.inProgress).toBe(true)
      expect(testDbQueue.queue.length).toBe(0)

      const transaction2Promise = testDb.transaction(async (tx) => {
        tx.execute(TEST_QUERY)
      })

      expect(testDbQueue.queue.length).toBe(1)
      expect(testDbQueue.inProgress).toBe(true)

      const transaction3Promise = testDb.transaction(async (tx) => {
        tx.execute(TEST_QUERY)
      })

      await transaction1Promise

      expect(testDbQueue.queue.length).toBe(1)
      expect(testDbQueue.inProgress).toBe(true)

      await transaction2Promise

      expect(testDbQueue.queue.length).toBe(0)
      expect(testDbQueue.inProgress).toBe(true)

      await transaction3Promise

      expect(testDbQueue.queue.length).toBe(0)
      expect(testDbQueue.inProgress).toBe(false)
    })

    it('multiple executeBatchAsync operations are queued', async () => {
      const executeBatch1Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).toBe(0)
      expect(testDbQueue.inProgress).toBe(true)

      const executeBatch2Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).toBe(1)
      expect(testDbQueue.inProgress).toBe(true)

      const executeBatch3Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).toBe(2)
      expect(testDbQueue.inProgress).toBe(true)

      await executeBatch1Promise

      expect(testDbQueue.queue.length).toBe(1)
      expect(testDbQueue.inProgress).toBe(true)

      await executeBatch2Promise

      expect(testDbQueue.queue.length).toBe(0)
      expect(testDbQueue.inProgress).toBe(true)

      await executeBatch3Promise

      expect(testDbQueue.queue.length).toBe(0)
      expect(testDbQueue.inProgress).toBe(false)
    })

    it('mixed transactions and executeBatchAsync operations are queued', async () => {
      const transaction1Promise = testDb.transaction(async (tx) => {
        tx.execute('SELECT * FROM [User];')
      })

      expect(testDbQueue.queue.length).toBe(0)
      expect(testDbQueue.inProgress).toBe(true)

      const executeBatch1Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).toBe(1)
      expect(testDbQueue.inProgress).toBe(true)

      const transaction2Promise = testDb.transaction(async (tx) => {
        tx.execute(TEST_QUERY)
      })

      expect(testDbQueue.queue.length).toBe(2)
      expect(testDbQueue.inProgress).toBe(true)

      const executeBatch2Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).toBe(3)
      expect(testDbQueue.inProgress).toBe(true)

      await transaction1Promise

      expect(testDbQueue.queue.length).toBe(2)
      expect(testDbQueue.inProgress).toBe(true)

      await executeBatch1Promise

      expect(testDbQueue.queue.length).toBe(1)
      expect(testDbQueue.inProgress).toBe(true)

      await transaction2Promise

      expect(testDbQueue.queue.length).toBe(0)
      expect(testDbQueue.inProgress).toBe(true)

      await executeBatch2Promise

      expect(testDbQueue.queue.length).toBe(0)
      expect(testDbQueue.inProgress).toBe(false)
    })

    it('errors are thrown through DatabaseQueue', async () => {
      const transaction1Promise = testDb.transaction(async (tx) => {
        tx.execute('SELECT * FROM [User];')
        throw TEST_ERROR
      })

      expect(testDbQueue.queue.length).toBe(0)
      expect(testDbQueue.inProgress).toBe(true)

      const executeBatch1Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).toBe(1)
      expect(testDbQueue.inProgress).toBe(true)

      try {
        await transaction1Promise

        expect(testDbQueue.queue.length).toBe(0)
        expect(testDbQueue.inProgress).toBe(true)
      } catch (e) {
        if (isNitroSQLiteError(e)) {
          expect(e.message).toContain(TEST_ERROR_MESSAGE)
        } else {
          throw new Error(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
        }
      }

      try {
        await executeBatch1Promise

        expect(testDbQueue.queue.length).toBe(0)
        expect(testDbQueue.inProgress).toBe(false)
      } catch (e) {
        if (isNitroSQLiteError(e)) {
          expect(e.message).toContain(TEST_ERROR_MESSAGE)
        } else {
          throw new Error(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
        }
      }
    })

    it('rejects a duplicate session open without replacing the original connection', () => {
      const dbName = 'duplicate-session-open'
      dropDatabaseIfExists(dbName)
      dropDatabaseIfExists(dbName, '..')

      const db = open({ name: dbName })

      try {
        db.execute('CREATE TABLE ConnectionMarker (value TEXT NOT NULL)')
        db.execute('INSERT INTO ConnectionMarker (value) VALUES (?)', [
          'original',
        ])

        let duplicateError: unknown
        try {
          open({ name: dbName, location: '..' })
        } catch (error) {
          duplicateError = error
        }

        expect(duplicateError).toBeInstanceOf(NitroSQLiteError)
        expect((duplicateError as Error).message).toContain('already open')
        expect(
          db.execute<{ value: string }>('SELECT value FROM ConnectionMarker')
            .results,
        ).toEqual([{ value: 'original' }])
      } finally {
        db.close()
        dropDatabaseIfExists(dbName)
        dropDatabaseIfExists(dbName, '..')
      }
    })

    it('rejects duplicate direct native opens', () => {
      const dbName = 'duplicate-native-open'
      dropDatabaseIfExists(dbName)

      NitroSQLite.native.open(dbName)

      try {
        NitroSQLite.execute(
          dbName,
          'CREATE TABLE ConnectionMarker (value TEXT NOT NULL)',
        )
        NitroSQLite.execute(
          dbName,
          'INSERT INTO ConnectionMarker (value) VALUES (?)',
          ['original'],
        )

        let duplicateError: unknown
        try {
          NitroSQLite.native.open(dbName)
        } catch (error) {
          duplicateError = error
        }

        expect(duplicateError).toBeInstanceOf(Error)
        expect((duplicateError as Error).message).toContain('already open')
        expect(
          NitroSQLite.execute<{ value: string }>(
            dbName,
            'SELECT value FROM ConnectionMarker',
          ).results,
        ).toEqual([{ value: 'original' }])
      } finally {
        NitroSQLite.native.close(dbName)
        dropDatabaseIfExists(dbName)
      }
    })
  })
}
