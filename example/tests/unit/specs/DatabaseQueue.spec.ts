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

function createDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

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

    it('queues ordinary async work behind a transaction rollback', async () => {
      const transactionStarted = createDeferred()
      const finishTransaction = createDeferred()
      const transactionPromise = testDb.transaction(async (tx) => {
        tx.execute(
          'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
          [1, 'transaction', 1, 1],
        )
        transactionStarted.resolve()
        await finishTransaction.promise
        throw new Error('rollback transaction')
      })

      await transactionStarted.promise
      const externalWrite = testDb.executeAsync(
        'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
        [2, 'external', 2, 2],
      )
      finishTransaction.resolve()

      try {
        await transactionPromise
      } catch (error) {
        expect((error as Error).message).toContain('rollback transaction')
      }
      await externalWrite

      expect(
        testDb.execute<{ id: number }>('SELECT id FROM User').results,
      ).toEqual([{ id: 2 }])
    })

    it('returns distinct insert IDs from parallel async inserts', async () => {
      testDb.execute(
        'CREATE TABLE ConcurrentInsert (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT)',
      )

      const results = await Promise.all(
        Array.from({ length: 24 }, (_, index) =>
          testDb.executeAsync(
            'INSERT INTO ConcurrentInsert (value) VALUES (?)',
            [`value-${index}`],
          ),
        ),
      )

      expect(results.map((result) => result.insertId)).toEqual(
        Array.from({ length: 24 }, (_, index) => index + 1),
      )
    })

    it('rejects sync work and close while async work is pending', async () => {
      const dbName = 'busy-close'
      dropDatabaseIfExists(dbName)
      const db = open({ name: dbName })

      const pending = db.executeAsync(
        'WITH RECURSIVE counter(value) AS (VALUES(0) UNION ALL SELECT value + 1 FROM counter WHERE value < 100000) SELECT sum(value) FROM counter',
      )

      const syncOperations = [
        () => db.execute('SELECT 1'),
        () => db.executeBatch([{ query: 'SELECT 1' }]),
        () => db.loadFile('/nitro-sqlite-does-not-exist.sql'),
        () => db.attach('other.sqlite', 'other'),
        () => db.detach('other'),
        () => db.delete(),
        () => db.close(),
      ]

      for (const operation of syncOperations) {
        let operationError: unknown
        try {
          operation()
        } catch (error) {
          operationError = error
        }

        expect(operationError).toBeInstanceOf(NitroSQLiteError)
        expect((operationError as Error).message).toContain('busy')
      }

      await pending
      db.close()
      const reopened = open({ name: dbName })
      reopened.close()
      reopened.delete()
    })

    it('releases the queue after loadFileAsync rejects', async () => {
      let loadError: unknown
      try {
        await testDb.loadFileAsync('/nitro-sqlite-does-not-exist.sql')
      } catch (error) {
        loadError = error
      }

      expect(loadError).toBeInstanceOf(NitroSQLiteError)
      expect((loadError as Error).message).toContain('Could not load file')
      expect((await testDb.executeAsync('SELECT 42 AS value')).results).toEqual(
        [{ value: 42 }],
      )
    })

    it('does not block operations on another database', async () => {
      const firstName = 'independent-first'
      const secondName = 'independent-second'
      dropDatabaseIfExists(firstName)
      dropDatabaseIfExists(secondName)
      const first = open({ name: firstName })
      const second = open({ name: secondName })
      const transactionStarted = createDeferred()
      const finishTransaction = createDeferred()

      try {
        const transactionPromise = first.transaction(async () => {
          transactionStarted.resolve()
          await finishTransaction.promise
        })
        await transactionStarted.promise

        const result = await second.executeAsync('SELECT 42 AS value')
        expect(result.results).toEqual([{ value: 42 }])

        finishTransaction.resolve()
        await transactionPromise
      } finally {
        finishTransaction.resolve()
        first.close()
        first.delete()
        second.close()
        second.delete()
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

    it('preserves an open connection when deleting a missing target', () => {
      const dbName = 'missing-delete-target'
      dropDatabaseIfExists(dbName)
      dropDatabaseIfExists(dbName, '..')
      const db = open({ name: dbName })

      try {
        db.execute('CREATE TABLE ConnectionMarker (value TEXT NOT NULL)')
        db.execute('INSERT INTO ConnectionMarker (value) VALUES (?)', [
          'original',
        ])

        let deleteError: unknown
        try {
          NitroSQLite.native.drop(dbName, '..')
        } catch (error) {
          deleteError = error
        }

        expect(deleteError).toBeInstanceOf(Error)
        expect((deleteError as Error).message).toContain(
          'Database file not found',
        )
        expect(
          db.execute<{ value: string }>('SELECT value FROM ConnectionMarker')
            .results,
        ).toEqual([{ value: 'original' }])
      } finally {
        db.close()
        dropDatabaseIfExists(dbName)
      }
    })

    it('serializes direct native async result metadata', async () => {
      const dbName = 'native-concurrent-inserts'
      dropDatabaseIfExists(dbName)
      NitroSQLite.native.open(dbName)

      try {
        NitroSQLite.native.execute(
          dbName,
          'CREATE TABLE Item (id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT)',
        )
        const results = await Promise.all(
          Array.from({ length: 24 }, (_, index) =>
            NitroSQLite.native.executeAsync(
              dbName,
              'INSERT INTO Item (value) VALUES (?)',
              [`value-${index}`],
            ),
          ),
        )

        const insertIds = results
          .map((result) => result.insertId)
          .sort((a, b) => (a ?? 0) - (b ?? 0))
        expect(insertIds).toEqual(
          Array.from({ length: 24 }, (_, index) => index + 1),
        )

        const storedRows = NitroSQLite.native.execute(
          dbName,
          'SELECT id, value FROM Item',
        ).results
        results.forEach((result, index) => {
          const storedRow = storedRows.find((row) => row.id === result.insertId)
          expect(storedRow?.value).toBe(`value-${index}`)
        })
      } finally {
        NitroSQLite.native.close(dbName)
        dropDatabaseIfExists(dbName)
      }
    })

    it('does not reroute native async work after close and reopen', async () => {
      const dbName = 'native-close-reopen'
      dropDatabaseIfExists(dbName)
      dropDatabaseIfExists(dbName, '..')
      NitroSQLite.native.open(dbName)

      try {
        NitroSQLite.native.execute(
          dbName,
          'CREATE TABLE ConnectionMarker (value TEXT NOT NULL)',
        )
        NitroSQLite.native.execute(
          dbName,
          'INSERT INTO ConnectionMarker (value) VALUES (?)',
          ['original'],
        )

        const pending = NitroSQLite.native.executeAsync(
          dbName,
          'WITH RECURSIVE counter(value) AS (VALUES(0) UNION ALL SELECT value + 1 FROM counter WHERE value < 100000) SELECT ConnectionMarker.value, sum(counter.value) AS total FROM ConnectionMarker, counter',
        )

        NitroSQLite.native.close(dbName)
        NitroSQLite.native.open(dbName, '..')
        NitroSQLite.native.execute(
          dbName,
          'CREATE TABLE ConnectionMarker (value TEXT NOT NULL)',
        )
        NitroSQLite.native.execute(
          dbName,
          'INSERT INTO ConnectionMarker (value) VALUES (?)',
          ['replacement'],
        )

        try {
          const result = await pending
          expect(result.results[0]?.value).toBe('original')
        } catch (error) {
          expect((error as Error).message).toContain('not open')
        }

        expect(
          NitroSQLite.execute<{ value: string }>(
            dbName,
            'SELECT value FROM ConnectionMarker',
          ).results,
        ).toEqual([{ value: 'replacement' }])
      } finally {
        dropDatabaseIfExists(dbName)
        dropDatabaseIfExists(dbName, '..')
      }
    })

    it('rejects missing native async databases asynchronously', async () => {
      const dbName = 'native-async-missing-database'
      dropDatabaseIfExists(dbName)

      const pending = NitroSQLite.native.executeAsync(dbName, 'SELECT 1')
      let asyncError: unknown
      try {
        await pending
      } catch (error) {
        asyncError = error
      }

      expect(asyncError).toBeInstanceOf(Error)
      expect((asyncError as Error).message).toContain('not open')
    })
  })
}
