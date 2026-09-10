import { chance, expect, isNitroSQLiteError } from '@tests/unit/common'
import { describe, it } from '@tests/TestApi'
import { createArrayBufferTestDb, testDb } from '@tests/db'
import { open } from 'react-native-nitro-sqlite'
import { buildJSQueryResult } from '../../../../../packages/react-native-nitro-sqlite/src/operations/execute'
import type { NitroSQLiteQueryResult } from '../../../../../packages/react-native-nitro-sqlite/src/specs/NitroSQLiteQueryResult.nitro'

const QUERY_RESULT_SIZES = [60, 1_000, 10_000]

function createQueryResultTestDb(name: string) {
  const db = open({ name })

  db.execute('DROP TABLE IF EXISTS QueryResultRows;')
  db.execute(
    'CREATE TABLE QueryResultRows (id INTEGER PRIMARY KEY, name TEXT NOT NULL, nullable TEXT, payload BLOB) STRICT;',
  )
  db.execute(`
    WITH RECURSIVE counter(id) AS (
      SELECT 1
      UNION ALL
      SELECT id + 1 FROM counter WHERE id < 10000
    )
    INSERT INTO QueryResultRows (id, name, nullable, payload)
    SELECT
      id,
      'row-' || id,
      CASE WHEN id = 1 THEN NULL ELSE 'value-' || id END,
      CASE WHEN id = 1 THEN zeroblob(4) ELSE NULL END
    FROM counter;
  `)

  return db
}

function expectQueryResultRows(
  result: ReturnType<typeof testDb.execute>,
  size: number,
) {
  expect(result.rows._array).toHaveLength(size)
  expect(result.rows.length).toBe(size)

  for (let index = 0; index < size; index++) {
    expect(result.rows.item(index)).toBe(result.rows._array[index])
  }

  expect(result.rows.item(size)).toBe(undefined)
  expect(result.rows.item(0)?.id).toBe(1)
  expect(result.rows.item(size - 1)?.id).toBe(size)
  expect(result.rows.item(0)?.nullable).toBe(null)

  const payload = result.rows.item(0)?.payload
  expect(payload).toBeInstanceOf(ArrayBuffer)
  expect(Array.from(new Uint8Array(payload as ArrayBuffer))).toEqual([
    0, 0, 0, 0,
  ])
}

export default function registerExecuteUnitTests() {
  describe('execute', () => {
    it('materializes native query results once', () => {
      const sourceRows = [
        { id: 1, nullable: null },
        { id: 2, nullable: 'value' },
      ]
      let resultsReads = 0
      const nativeResult = {
        rowsAffected: sourceRows.length,
        get results() {
          resultsReads += 1
          return [...sourceRows]
        },
      } as unknown as NitroSQLiteQueryResult

      const result = buildJSQueryResult(nativeResult)

      expect(result.rows._array).toEqual(sourceRows)
      expect(result.rows.length).toBe(sourceRows.length)
      expect(result.rows.item(0)).toEqual(sourceRows[0])
      expect(result.rows.item(1)).toEqual(sourceRows[1])
      expect(result.rows.item(sourceRows.length)).toBe(undefined)
      expect(resultsReads).toBe(1)
    })

    it('preserves row access for large synchronous results', () => {
      const db = createQueryResultTestDb('query_result_rows_sync')

      try {
        for (const size of QUERY_RESULT_SIZES) {
          const result = db.execute(
            'SELECT * FROM QueryResultRows ORDER BY id LIMIT ?',
            [size],
          )

          expectQueryResultRows(result, size)
        }
      } finally {
        db.close()
        db.delete()
      }
    })

    it('preserves row access for large asynchronous results', async () => {
      const db = createQueryResultTestDb('query_result_rows_async')

      try {
        for (const size of QUERY_RESULT_SIZES) {
          const result = await db.executeAsync(
            'SELECT * FROM QueryResultRows ORDER BY id LIMIT ?',
            [size],
          )

          expectQueryResultRows(result, size)
        }
      } finally {
        db.close()
        db.delete()
      }
    })

    describe('Insert', () => {
      it('Insert', () => {
        const id = chance.integer()
        const name = chance.name()
        const age = chance.integer()
        const networth = chance.floating()
        const res = testDb.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )

        expect(res.rowsAffected).toBe(1)
        expect(res.insertId).toBe(1)
        expect(res.rows?._array).toEqual([])
        expect(res.rows?.length).toBe(0)
        expect(res.rows?.item).toBeTypeOf('function')
      })

      it('Insert with null', () => {
        const id = chance.integer()
        const name = chance.name()
        const age = null
        const networth = null
        const res = testDb.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )

        expect(res.rowsAffected).toBe(1)
        expect(res.insertId).toBe(1)
        expect(res.rows?._array).toEqual([])
        expect(res.rows?.length).toBe(0)
        expect(res.rows?.item).toBeTypeOf('function')

        const selectRes = testDb.execute('SELECT * FROM User')
        expect(selectRes.rows?._array).toEqual([
          {
            id,
            name,
            age,
            networth,
          },
        ])
      })

      it('Failed insert', () => {
        const id = chance.integer()
        const name = chance.name()
        const age = chance.string()
        const networth = chance.string()

        try {
          testDb.execute(
            'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
            [id, name, age, networth],
          )
        } catch (e: unknown) {
          if (isNitroSQLiteError(e)) {
            expect(e.message).toContain(
              'cannot store TEXT value in REAL column User.age',
            )
          } else {
            throw new Error('Should have thrown a valid NitroSQLiteException')
          }
        }
      })

      it('Insertion correctly throws', () => {
        const id = chance.string()
        const name = chance.name()
        const age = chance.integer()
        const networth = chance.floating()
        try {
          testDb.execute(
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
            [id, name, age, networth],
          )
        } catch (e: unknown) {
          expect(e).not.toBe(null)
        }
      })
    })

    describe('Select', () => {
      it('Query without params', () => {
        const id = chance.integer()
        const name = chance.name()
        const age = chance.integer()
        const networth = chance.floating()
        testDb.execute(
          'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )

        const res = testDb.execute('SELECT * FROM User')

        expect(res.rowsAffected).toBe(1)
        expect(res.insertId).toBe(1)
        expect(res.rows?._array).toEqual([
          {
            id,
            name,
            age,
            networth,
          },
        ])
      })

      it('Query with params', () => {
        const id = chance.integer()
        const name = chance.name()
        const age = chance.integer()
        const networth = chance.floating()
        testDb.execute(
          'INSERT INTO User (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )

        const res = testDb.execute('SELECT * FROM User WHERE id = ?', [id])

        expect(res.rowsAffected).toBe(1)
        expect(res.insertId).toBe(1)
        expect(res.rows?._array).toEqual([
          {
            id,
            name,
            age,
            networth,
          },
        ])
      })
    })

    describe('ArrayBuffer support', () => {
      describe('execute', () => {
        it('stores and reads ArrayBuffer values from BLOB columns', () => {
          const dbName = 'array_buffer_read'
          const db = createArrayBufferTestDb(dbName)

          const originalBytes = new Uint8Array([10, 20, 30, 40])
          const originalBuffer = originalBytes.buffer

          try {
            db.execute('INSERT INTO BlobData (id, data) VALUES (?, ?)', [
              1,
              originalBuffer,
            ])

            const result = db.execute(
              'SELECT data FROM BlobData WHERE id = ?',
              [1],
            )

            expect(result.rowsAffected).toBe(1)
            expect(result.rows?.length).toBe(1)

            const row = result.results[0]
            // const row = result.rows?.item(0)
            expect(row).not.toBe(undefined)

            const value = row?.data
            expect(value).toBeInstanceOf(ArrayBuffer)

            const returnedBytes = new Uint8Array(value as ArrayBuffer)
            expect(Array.from(returnedBytes)).toEqual(Array.from(originalBytes))
          } finally {
            db.close()
            db.delete()
          }
        })
      })

      describe('executeAsync', () => {
        it('stores and reads ArrayBuffer values from BLOB columns', async () => {
          const dbName = 'array_buffer_read'
          const db = createArrayBufferTestDb(dbName)

          const originalBytes = new Uint8Array([10, 20, 30, 40])
          const originalBuffer = originalBytes.buffer

          try {
            await db.executeAsync(
              'INSERT INTO BlobData (id, data) VALUES (?, ?)',
              [1, originalBuffer],
            )

            const result = await db.executeAsync(
              'SELECT data FROM BlobData WHERE id = ?',
              [1],
            )

            expect(result.rowsAffected).toBe(1)
            expect(result.rows?.length).toBe(1)

            const row = result.results[0]
            // const row = result.rows?.item(0)
            expect(row).not.toBe(undefined)

            const value = row?.data
            expect(value).toBeInstanceOf(ArrayBuffer)

            const returnedBytes = new Uint8Array(value as ArrayBuffer)
            expect(Array.from(returnedBytes)).toEqual(Array.from(originalBytes))
          } finally {
            db.close()
            db.delete()
          }
        })
      })

      describe('executeBatchAsync', () => {
        it('stores ArrayBuffer values in BLOB columns', async () => {
          const dbName = 'array_buffer_batch_async'
          const db = createArrayBufferTestDb(dbName)

          const originalBytes = new Uint8Array([1, 2, 3, 4, 5])
          const originalBuffer = originalBytes.buffer

          try {
            await db.executeBatchAsync([
              {
                query: 'INSERT INTO BlobData (id, data) VALUES (?, ?)',
                params: [1, originalBuffer],
              },
            ])

            const result = db.execute(
              'SELECT data FROM BlobData WHERE id = ?',
              [1],
            )

            expect(result.rowsAffected).toBe(1)
            expect(result.rows?.length).toBe(1)

            const row = result.results[0]
            expect(row).not.toBe(undefined)

            const value = row?.data
            expect(value).toBeInstanceOf(ArrayBuffer)

            const returnedBytes = new Uint8Array(value as ArrayBuffer)
            expect(Array.from(returnedBytes)).toEqual(Array.from(originalBytes))
          } finally {
            db.close()
            db.delete()
          }
        })
      })
    })
  })
}
