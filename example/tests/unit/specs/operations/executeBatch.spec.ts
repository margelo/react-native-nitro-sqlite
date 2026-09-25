import { chance, expect } from '@tests/unit/common'
import {
  NitroSQLiteError,
  type BatchQueryCommand,
} from 'react-native-nitro-sqlite'
import { describe, it } from '@tests/TestApi'
import { testDb } from '@tests/db'

export default function registerExecuteBatchUnitTests() {
  describe('executeBatch', () => {
    it('executeBatch', () => {
      const id1 = chance.integer()
      const name1 = chance.name()
      const age1 = chance.integer()
      const networth1 = chance.floating()

      const id2 = chance.integer()
      const name2 = chance.name()
      const age2 = chance.integer()
      const networth2 = chance.floating()
      const commands: BatchQueryCommand[] = [
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id1, name1, age1, networth1],
        },
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id2, name2, age2, networth2],
        },
      ]

      testDb.executeBatch(commands)

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).toEqual([
        { id: id1, name: name1, age: age1, networth: networth1 },
        {
          id: id2,
          name: name2,
          age: age2,
          networth: networth2,
        },
      ])
    })

    it('reports zero rows affected for read-only commands', () => {
      const id = chance.integer()
      testDb.execute(
        'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
        [id, chance.name(), chance.integer(), chance.floating()],
      )

      const result = testDb.executeBatch([
        {
          query: 'SELECT * FROM User WHERE id = ?',
          params: [id],
        },
      ])

      expect(result.rowsAffected).toBe(0)
    })

    it('Async batch execute', async () => {
      const id1 = chance.integer()
      const name1 = chance.name()
      const age1 = chance.integer()
      const networth1 = chance.floating()
      const id2 = chance.integer()
      const name2 = chance.name()
      const age2 = chance.integer()
      const networth2 = chance.floating()
      const commands: BatchQueryCommand[] = [
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id1, name1, age1, networth1],
        },
        {
          query:
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          params: [id2, name2, age2, networth2],
        },
      ]

      await testDb.executeBatchAsync(commands)

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).toEqual([
        { id: id1, name: name1, age: age1, networth: networth1 },
        {
          id: id2,
          name: name2,
          age: age2,
          networth: networth2,
        },
      ])
    })

    it('expands nested parameters into separate statements', () => {
      const result = testDb.executeBatch([
        {
          query:
            'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
          params: [
            [1, 'first', 10, 100],
            [2, 'second', 20, 200],
          ],
        },
      ])

      expect(result.rowsAffected).toBe(2)
      expect(
        testDb.execute('SELECT id, name FROM User ORDER BY id').results,
      ).toEqual([
        { id: 1, name: 'first' },
        { id: 2, name: 'second' },
      ])
    })

    it('expands nested parameters in asynchronous batches', async () => {
      const result = await testDb.executeBatchAsync([
        {
          query:
            'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
          params: [
            [1, 'first', 10, 100],
            [2, 'second', 20, 200],
          ],
        },
      ])

      expect(result.rowsAffected).toBe(2)
      expect(
        testDb.execute('SELECT id, name FROM User ORDER BY id').results,
      ).toEqual([
        { id: 1, name: 'first' },
        { id: 2, name: 'second' },
      ])
    })

    it('clears bindings between grouped executions', () => {
      testDb.execute(
        'CREATE TABLE batch_values (id INTEGER, value TEXT, data BLOB)',
      )
      const bytes = new Uint8Array([0, 7, 255]).buffer

      const result = testDb.executeBatch([
        {
          query: 'INSERT INTO batch_values VALUES (?, ?, ?)',
          params: [[1, 'first', bytes], [2, null], [3]],
        },
      ])

      expect(result.rowsAffected).toBe(3)
      const rows = testDb.execute(
        'SELECT * FROM batch_values ORDER BY id',
      ).results
      expect(
        rows.map(({ id, value, data }) => [id, value, data == null]),
      ).toEqual([
        [1, 'first', false],
        [2, null, true],
        [3, null, true],
      ])
      expect(Array.from(new Uint8Array(rows[0]?.data as ArrayBuffer))).toEqual([
        0, 7, 255,
      ])
    })

    it('rejects a batch containing only empty parameter groups', () => {
      expect(() =>
        testDb.executeBatch([
          { query: 'INSERT INTO missing_table VALUES (?)', params: [] },
        ]),
      ).toThrow()
    })

    it('keeps empty groups and schema commands in batch order', async () => {
      const result = await testDb.executeBatchAsync([
        { query: 'INSERT INTO missing_table VALUES (?)', params: [] },
        { query: 'CREATE TABLE batch_schema (value TEXT)' },
        {
          query: 'INSERT INTO batch_schema VALUES (?)',
          params: [['first'], ['second']],
        },
        { query: 'SELECT value FROM batch_schema', params: [] },
      ])

      expect(result.rowsAffected).toBe(2)
      expect(testDb.execute('SELECT value FROM batch_schema').results).toEqual([
        { value: 'first' },
        { value: 'second' },
      ])
    })

    it('rolls back a grouped batch after a middle execution fails', async () => {
      let batchError: unknown
      try {
        await testDb.executeBatchAsync([
          {
            query: 'INSERT INTO User (id, name) VALUES (?, ?)',
            params: [
              [1, 'first'],
              [1, 'duplicate'],
              [2, 'last'],
            ],
          },
        ])
      } catch (error) {
        batchError = error
      }

      expect(batchError).toBeInstanceOf(NitroSQLiteError)
      expect(testDb.execute('SELECT id FROM User').results).toEqual([])
      expect(
        testDb.executeBatch([
          {
            query: 'INSERT INTO User (id, name) VALUES (?, ?)',
            params: [
              [3, 'after error'],
              [4, 'still reusable'],
            ],
          },
        ]).rowsAffected,
      ).toBe(2)
    })

    it('rolls back when repeated schema SQL fails on its second execution', () => {
      let batchError: unknown
      try {
        testDb.executeBatch([
          {
            query: 'CREATE TABLE repeated_schema (value INTEGER)',
            params: [[], []],
          },
        ])
      } catch (error) {
        batchError = error
      }

      expect(batchError).toBeInstanceOf(NitroSQLiteError)
      expect(
        testDb.execute(
          "SELECT name FROM sqlite_master WHERE name = 'repeated_schema'",
        ).results,
      ).toEqual([])
    })

    it('rolls back every statement when a synchronous batch fails', () => {
      let batchError: unknown
      try {
        testDb.executeBatch([
          {
            query:
              'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
            params: [1, 'first', 10, 100],
          },
          { query: 'INSERT INTO MissingTable (value) VALUES (1)' },
        ])
      } catch (error) {
        batchError = error
      }

      expect(batchError).toBeInstanceOf(NitroSQLiteError)
      expect(testDb.execute('SELECT id FROM User').results).toEqual([])
      expect(
        testDb.executeBatch([
          {
            query:
              "INSERT INTO User (id, name, age, networth) VALUES (2, 'later', 20, 200)",
          },
        ]).rowsAffected,
      ).toBe(1)
    })

    it('rolls back every statement when an asynchronous batch fails', async () => {
      let batchError: unknown
      try {
        await testDb.executeBatchAsync([
          {
            query:
              'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
            params: [1, 'first', 10, 100],
          },
          { query: 'INSERT INTO MissingTable (value) VALUES (1)' },
        ])
      } catch (error) {
        batchError = error
      }

      expect(batchError).toBeInstanceOf(NitroSQLiteError)
      expect(testDb.execute('SELECT id FROM User').results).toEqual([])
      expect(
        (
          await testDb.executeBatchAsync([
            {
              query:
                "INSERT INTO User (id, name, age, networth) VALUES (2, 'later', 20, 200)",
            },
          ])
        ).rowsAffected,
      ).toBe(1)
    })

    it('rejects empty batches without leaving a transaction open', async () => {
      let syncError: unknown
      try {
        testDb.executeBatch([])
      } catch (error) {
        syncError = error
      }

      let asyncError: unknown
      try {
        await testDb.executeBatchAsync([])
      } catch (error) {
        asyncError = error
      }

      expect(syncError).toBeInstanceOf(NitroSQLiteError)
      expect(asyncError).toBeInstanceOf(NitroSQLiteError)
      expect(testDb.execute('SELECT 1 AS value').results).toEqual([
        { value: 1 },
      ])
    })
  })
}
