import {
  expect,
  isNitroSQLiteError,
  TEST_ERROR_CODES,
} from '@tests/unit/common'
import { describe, it } from '@tests/TestApi'
import { testDb } from '@tests/db'

const valuesQuery =
  'SELECT 1 AS duplicate, 2 AS duplicate, 3.5 AS "café", NULL AS nullable, zeroblob(2) AS payload'

const joinQuery = `
  SELECT owners.id, owners.name, pets.id, pets.name
  FROM owners LEFT JOIN pets ON pets.owner_id = owners.id
  ORDER BY owners.id
`

function createJoinTables() {
  testDb.execute('CREATE TABLE owners (id INTEGER PRIMARY KEY, name TEXT)')
  testDb.execute(
    'CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT, owner_id INTEGER)',
  )
  testDb.execute("INSERT INTO owners VALUES (1, 'Dave'), (2, 'Ritesh')")
  testDb.execute("INSERT INTO pets VALUES (7, 'Rex', 1)")
}

function expectValuesRow(row: unknown[] | undefined) {
  expect(row?.slice(0, 4)).toEqual([1, 2, 3.5, null])
  expect(Array.from(new Uint8Array(row?.[4] as ArrayBuffer))).toEqual([0, 0])
}

export default function registerExecuteRawUnitTests() {
  describe('executeRaw', () => {
    it('returns every value type and keeps repeated column names', async () => {
      const result = testDb.executeRaw(valuesQuery)
      expect(result.columnNames).toEqual([
        'duplicate',
        'duplicate',
        'café',
        'nullable',
        'payload',
      ])
      expect(result.rows).toHaveLength(1)
      expectValuesRow(result.rows[0])

      const asyncResult = await testDb.executeRawAsync(valuesQuery)
      expect(asyncResult.columnNames).toEqual(result.columnNames)
      expectValuesRow(asyncResult.rows[0])
    })

    it('keeps both sides of a join with matching column names', async () => {
      createJoinTables()
      const expected = [
        [1, 'Dave', 7, 'Rex'],
        [2, 'Ritesh', null, null],
      ]

      const result = testDb.executeRaw(joinQuery)
      expect(result.columnNames).toEqual(['id', 'name', 'id', 'name'])
      expect(result.rows).toEqual(expected)
      expect((await testDb.executeRawAsync(joinQuery)).rows).toEqual(expected)
    })

    it('binds parameters and reports changes for writes', async () => {
      const inserted = testDb.executeRaw(
        'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
        [1, 'Ada', 36, 1.5],
      )
      expect(inserted.rowsAffected).toBe(1)
      expect(inserted.insertId).toBe(1)
      expect(inserted.columnNames).toEqual([])
      expect(inserted.rows).toEqual([])

      const selected = await testDb.executeRawAsync(
        'SELECT name, age FROM User WHERE id = ?',
        [1],
      )
      expect(selected.rows).toEqual([['Ada', 36]])
    })

    it('returns column names for an empty result', () => {
      const result = testDb.executeRaw('SELECT id, name FROM User WHERE 0')
      expect(result.columnNames).toEqual(['id', 'name'])
      expect(result.rows).toEqual([])
    })

    it('returns large results in order', async () => {
      const query = `
        WITH RECURSIVE counter(value) AS (
          SELECT 1 UNION ALL SELECT value + 1 FROM counter WHERE value < 10000
        )
        SELECT value, 'row-' || value FROM counter
      `
      for (const result of [
        testDb.executeRaw(query),
        await testDb.executeRawAsync(query),
      ]) {
        expect(result.rows).toHaveLength(10_000)
        expect(result.rows[0]).toEqual([1, 'row-1'])
        expect(result.rows[9_999]).toEqual([10_000, 'row-10000'])
      }
    })

    it('runs inside a transaction', async () => {
      createJoinTables()
      await testDb.transaction(async (tx) => {
        tx.executeRaw("INSERT INTO pets VALUES (8, 'Tom', 2)")
        expect((await tx.executeRawAsync(joinQuery)).rows).toEqual([
          [1, 'Dave', 7, 'Rex'],
          [2, 'Ritesh', 8, 'Tom'],
        ])
      })
    })

    it('runs prepared statements and switches between raw and object rows', async () => {
      createJoinTables()
      const statement = testDb.prepare(`${joinQuery} LIMIT ?`)
      try {
        expect(statement.executeRaw([1]).rows).toEqual([[1, 'Dave', 7, 'Rex']])
        expect(statement.execute([1]).results).toEqual([{ id: 7, name: 'Rex' }])
        const asyncResult = await statement.executeRawAsync([2])
        expect(asyncResult.columnNames).toEqual(['id', 'name', 'id', 'name'])
        expect(asyncResult.rows).toHaveLength(2)
      } finally {
        statement.finalize()
      }
    })

    it('throws NitroSQLiteError for invalid SQL', async () => {
      try {
        testDb.executeRaw('SELECT * FROM missing_table')
        throw new Error(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
      } catch (error) {
        expect(isNitroSQLiteError(error)).toBe(true)
      }

      try {
        await testDb.executeRawAsync('SELECT * FROM missing_table')
        throw new Error(TEST_ERROR_CODES.EXPECT_PROMISE_REJECTION)
      } catch (error) {
        expect(isNitroSQLiteError(error)).toBe(true)
      }
    })
  })
}
