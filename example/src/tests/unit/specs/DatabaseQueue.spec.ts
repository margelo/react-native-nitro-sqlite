import {
  expect,
  isNitroSQLiteError,
  TEST_ERROR,
  TEST_ERROR_CODES,
  TEST_ERROR_MESSAGE,
} from '../common'
import { describe, it } from '../../MochaRNAdapter'
import { testDb, testDbQueue } from '../../db'
import type { BatchQueryCommand } from 'react-native-nitro-sqlite'

const TEST_QUERY = 'SELECT * FROM [User];'

const TEST_BATCH_COMMANDS: BatchQueryCommand[] = [{ query: TEST_QUERY }]

export default function registerDatabaseQueueUnitTests() {
  describe('Database Queue', () => {
    it('multiple transactions are queued', async () => {
      const transaction1Promise = testDb.transaction(async (tx) => {
        tx.execute(TEST_QUERY)

        expect(testDbQueue.queue.length).to.equal(2)
        expect(testDbQueue.inProgress).to.equal(true)

        await new Promise<void>((resolve) => setTimeout(resolve, 100))

        tx.execute(TEST_QUERY)

        expect(testDbQueue.queue.length).to.equal(2)
        expect(testDbQueue.inProgress).to.equal(true)
      })

      expect(testDbQueue.inProgress).to.equal(true)
      expect(testDbQueue.queue.length).to.equal(0)

      const transaction2Promise = testDb.transaction(async (tx) => {
        tx.execute(TEST_QUERY)
      })

      expect(testDbQueue.queue.length).to.equal(1)
      expect(testDbQueue.inProgress).to.equal(true)

      const transaction3Promise = testDb.transaction(async (tx) => {
        tx.execute(TEST_QUERY)
      })

      await transaction1Promise

      expect(testDbQueue.queue.length).to.equal(1)
      expect(testDbQueue.inProgress).to.equal(true)

      await transaction2Promise

      expect(testDbQueue.queue.length).to.equal(0)
      expect(testDbQueue.inProgress).to.equal(true)

      await transaction3Promise

      expect(testDbQueue.queue.length).to.equal(0)
      expect(testDbQueue.inProgress).to.equal(false)
    })

    it('multiple executeBatchAsync operations are queued', async () => {
      const executeBatch1Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).to.equal(0)
      expect(testDbQueue.inProgress).to.equal(true)

      const executeBatch2Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).to.equal(1)
      expect(testDbQueue.inProgress).to.equal(true)

      const executeBatch3Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).to.equal(2)
      expect(testDbQueue.inProgress).to.equal(true)

      await executeBatch1Promise

      expect(testDbQueue.queue.length).to.equal(1)
      expect(testDbQueue.inProgress).to.equal(true)

      await executeBatch2Promise

      expect(testDbQueue.queue.length).to.equal(0)
      expect(testDbQueue.inProgress).to.equal(true)

      await executeBatch3Promise

      expect(testDbQueue.queue.length).to.equal(0)
      expect(testDbQueue.inProgress).to.equal(false)
    })

    it('mixed transactions and executeBatchAsync operations are queued', async () => {
      const transaction1Promise = testDb.transaction(async (tx) => {
        tx.execute('SELECT * FROM [User];')
      })

      expect(testDbQueue.queue.length).to.equal(0)
      expect(testDbQueue.inProgress).to.equal(true)

      const executeBatch1Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).to.equal(1)
      expect(testDbQueue.inProgress).to.equal(true)

      const transaction2Promise = testDb.transaction(async (tx) => {
        tx.execute(TEST_QUERY)
      })

      expect(testDbQueue.queue.length).to.equal(2)
      expect(testDbQueue.inProgress).to.equal(true)

      const executeBatch2Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).to.equal(3)
      expect(testDbQueue.inProgress).to.equal(true)

      await transaction1Promise

      expect(testDbQueue.queue.length).to.equal(2)
      expect(testDbQueue.inProgress).to.equal(true)

      await executeBatch1Promise

      expect(testDbQueue.queue.length).to.equal(1)
      expect(testDbQueue.inProgress).to.equal(true)

      await transaction2Promise

      expect(testDbQueue.queue.length).to.equal(0)
      expect(testDbQueue.inProgress).to.equal(true)

      await executeBatch2Promise

      expect(testDbQueue.queue.length).to.equal(0)
      expect(testDbQueue.inProgress).to.equal(false)
    })

    it('errors are thrown through DatabaseQueue', async () => {
      const transaction1Promise = testDb.transaction(async (tx) => {
        tx.execute('SELECT * FROM [User];')
        throw TEST_ERROR
      })

      expect(testDbQueue.queue.length).to.equal(0)
      expect(testDbQueue.inProgress).to.equal(true)

      const executeBatch1Promise = testDb.executeBatchAsync(TEST_BATCH_COMMANDS)

      expect(testDbQueue.queue.length).to.equal(1)
      expect(testDbQueue.inProgress).to.equal(true)

      try {
        await transaction1Promise

        expect(testDbQueue.queue.length).to.equal(0)
        expect(testDbQueue.inProgress).to.equal(true)
      } catch (e) {
        if (isNitroSQLiteError(e)) {
          expect(e.message).to.include(TEST_ERROR_MESSAGE)
        } else {
          expect.fail(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
        }
      }

      try {
        await executeBatch1Promise

        expect(testDbQueue.queue.length).to.equal(0)
        expect(testDbQueue.inProgress).to.equal(false)
      } catch (e) {
        if (isNitroSQLiteError(e)) {
          expect(e.message).to.include(TEST_ERROR_MESSAGE)
        } else {
          expect.fail(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
        }
      }
    })
  })
}
