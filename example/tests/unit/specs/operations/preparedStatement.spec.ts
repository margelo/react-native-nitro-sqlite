import {
  chance,
  expect,
  isNitroSQLiteError,
  TEST_ERROR_CODES,
} from '@tests/unit/common'
import { describe, it } from '@tests/TestApi'
import { testDb } from '@tests/db'

export default function registerPreparedStatementUnitTests() {
  describe('prepared statements', () => {
    it('preserves embedded NULs across repeated execution', () => {
      const nul = String.fromCharCode(0)
      const firstValue = `${nul}leading`
      const values = [
        firstValue,
        `mid${nul}dle`,
        `trailing${nul}`,
        `é${nul}中😀`,
        '',
      ]
      const statement = testDb.prepare('SELECT ? AS value')

      try {
        for (const value of values) {
          const result = statement.execute([value])
          expect(result.rows.item(0)?.value).toBe(value)
        }

        expect(statement.execute([firstValue]).rows.item(0)?.value).toBe(
          firstValue,
        )
      } finally {
        statement.finalize()
      }
    })

    it('reuses one statement with different parameter values', () => {
      const insert = testDb.prepare(
        'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
      )
      const firstUser = {
        id: chance.integer(),
        name: chance.name(),
        age: chance.integer(),
        networth: chance.floating(),
      }
      const secondUser = {
        id: chance.integer(),
        name: chance.name(),
        age: chance.integer(),
        networth: chance.floating(),
      }

      expect(insert.isFinalized).toBe(false)
      expect(
        insert.execute([
          firstUser.id,
          firstUser.name,
          firstUser.age,
          firstUser.networth,
        ]).rowsAffected,
      ).toBe(1)
      expect(
        insert.execute([
          secondUser.id,
          secondUser.name,
          secondUser.age,
          secondUser.networth,
        ]).rowsAffected,
      ).toBe(1)

      const select = testDb.prepare('SELECT * FROM User WHERE id = ?')
      expect(select.execute([firstUser.id]).rows._array).toEqual([firstUser])
      expect(select.execute([secondUser.id]).rows._array).toEqual([secondUser])

      insert.finalize()
      select.finalize()
      expect(insert.isFinalized).toBe(true)
      expect(select.isFinalized).toBe(true)
    })

    it('executes asynchronously', async () => {
      const id = chance.integer()
      const statement = testDb.prepare(
        'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
      )

      const result = await statement.executeAsync([
        id,
        chance.name(),
        chance.integer(),
        chance.floating(),
      ])

      expect(result.rowsAffected).toBe(1)
      expect(
        testDb.execute('SELECT * FROM User WHERE id = ?', [id]).rows.length,
      ).toBe(1)
      statement.finalize()
    })

    it('can run again after an execution error', () => {
      const statement = testDb.prepare(
        'INSERT INTO User (id, name, age, networth) VALUES (?, ?, ?, ?)',
      )
      statement.execute([42, 'Ada', 37, 1])

      try {
        statement.execute([42, 'Duplicate', 37, 1])
        throw new Error('Expected duplicate key to fail')
      } catch (error) {
        expect(isNitroSQLiteError(error)).toBe(true)
      }

      expect(statement.execute([43, 'Grace', 38, 2]).rowsAffected).toBe(1)
      statement.finalize()
    })

    it('rejects execution after finalization', () => {
      const statement = testDb.prepare('SELECT * FROM User')
      statement.finalize()

      try {
        statement.execute()
        throw new Error('Expected execution to throw after finalization')
      } catch (error) {
        expect(isNitroSQLiteError(error)).toBe(true)
        if (isNitroSQLiteError(error)) {
          expect(error.message).toContain(
            'Prepared statement has been finalized',
          )
        }
      }
    })

    it('rejects a query that contains no SQL', () => {
      for (const query of ['', '-- just a comment']) {
        try {
          testDb.prepare(query)
          throw new Error(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
        } catch (error) {
          if (!isNitroSQLiteError(error)) throw error
          expect(error.message).toContain(
            'Query does not contain any SQL statement',
          )
        }
      }
    })
  })
}
