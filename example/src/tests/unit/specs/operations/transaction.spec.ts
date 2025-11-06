import {
  chance,
  expect,
  isNitroSQLiteError,
  TEST_ERROR,
  TEST_ERROR_MESSAGE,
  TEST_ERROR_CODES,
} from '../../common'
import { describe, it } from '../../../MochaRNAdapter'
import type { User } from '../../../../model/User'
import { testDb } from '../../../db'

export default function registerTransactionUnitTests() {
  describe('transaction', () => {
    it('Transaction, auto commit', async () => {
      const id = chance.integer()
      const name = chance.name()
      const age = chance.integer()
      const networth = chance.floating()

      await testDb.transaction(async (tx) => {
        const res = tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )

        expect(res.rowsAffected).to.equal(1)
        expect(res.insertId).to.equal(1)
        expect(res.rows?._array).to.eql([])
        expect(res.rows?.length).to.equal(0)
        expect(res.rows?.item).to.be.a('function')
      })

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ])
    })

    it('Transaction, manual commit', async () => {
      const id = chance.integer()
      const name = chance.name()
      const age = chance.integer()
      const networth = chance.floating()

      await testDb.transaction(async (tx) => {
        const res = tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )

        expect(res.rowsAffected).to.equal(1)
        expect(res.insertId).to.equal(1)
        expect(res.rows?._array).to.eql([])
        expect(res.rows?.length).to.equal(0)
        expect(res.rows?.item).to.be.a('function')

        tx.commit()
      })

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ])
    })

    it('Transaction, executed in order', async () => {
      // ARRANGE: Setup for multiple transactions
      const iterations = 10
      const actual: unknown[] = []

      // ARRANGE: Generate expected data
      const id = chance.integer()
      const name = chance.name()
      const age = chance.integer()

      // ACT: Start multiple transactions to upsert and select the same record
      const promises = []
      for (let iteration = 1; iteration <= iterations; iteration++) {
        const promised = testDb.transaction(async (tx) => {
          // ACT: Upsert statement to create record / increment the value
          tx.execute(
            `
            INSERT OR REPLACE INTO [User] ([id], [name], [age], [networth])
            SELECT ?, ?, ?,
              IFNULL((
                SELECT [networth] + 1000
                FROM [User]
                WHERE [id] = ?
              ), 0)
        `,
            [id, name, age, id],
          )

          // ACT: Select statement to get incremented value and store it for checking later
          const results = tx.execute(
            'SELECT [networth] FROM [User] WHERE [id] = ?',
            [id],
          )

          const row = results.rows?._array[0] as User | undefined
          actual.push(row?.networth)
        })

        promises.push(promised)
      }

      // ACT: Wait for all transactions to complete
      await Promise.all(promises)

      // ASSERT: That the expected values where returned
      const expected = Array(iterations)
        .fill(0)
        .map((_, index) => index * 1000)
      expect(actual).to.eql(
        expected,
        'Each transaction should read a different value',
      )
    })

    it('Transaction, cannot execute after commit', async () => {
      const id = chance.integer()
      const name = chance.name()
      const age = chance.integer()
      const networth = chance.floating()

      await testDb.transaction(async (tx) => {
        const res = tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )

        expect(res.rowsAffected).to.equal(1)
        expect(res.insertId).to.equal(1)
        expect(res.rows?._array).to.eql([])
        expect(res.rows?.length).to.equal(0)
        expect(res.rows?.item).to.be.a('function')

        tx.commit()

        try {
          tx.execute('SELECT * FROM "User"')
        } catch (e) {
          expect(e).to.not.equal(undefined)
        }
      })

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ])
    })

    it('Incorrect transaction, manual rollback', async () => {
      const id = chance.string()
      const name = chance.name()
      const age = chance.integer()
      const networth = chance.floating()

      await testDb.transaction(async (tx) => {
        try {
          tx.execute(
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
            [id, name, age, networth],
          )
        } catch {
          tx.rollback()
        }
      })

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).to.eql([])
    })

    it('Rollback', async () => {
      const id = chance.integer()
      const name = chance.name()
      const age = chance.integer()
      const networth = chance.floating()

      await testDb.transaction(async (tx) => {
        tx.execute(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )
        tx.rollback()
        const res = testDb.execute('SELECT * FROM User')
        expect(res.rows?._array).to.eql([])
      })
    })

    it('Transaction, rejects on callback error', async () => {
      const promised = testDb.transaction(async () => {
        throw TEST_ERROR
      })

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function')
      try {
        await promised
        expect.fail(TEST_ERROR_CODES.EXPECT_PROMISE_REJECTION)
      } catch (e) {
        if (isNitroSQLiteError(e))
          expect(e.message).to.include(TEST_ERROR_MESSAGE)
        else expect.fail(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
      }
    })

    it('Transaction, rejects on invalid query', async () => {
      const promised = testDb.transaction(async (tx) => {
        tx.execute('SELECT * FROM [tableThatDoesNotExist];')
      })
      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function')
      try {
        await promised
        expect.fail(TEST_ERROR_CODES.EXPECT_PROMISE_REJECTION)
      } catch (e) {
        if (isNitroSQLiteError(e))
          expect(e.message).to.include('no such table: tableThatDoesNotExist')
        else expect.fail(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
      }
    })

    it('Transaction, handle async callback', async () => {
      let ranCallback = false
      const promised = testDb.transaction(async (tx) => {
        await new Promise<void>((done) => {
          setTimeout(() => done(), 50)
        })
        tx.execute('SELECT * FROM [User];')
        ranCallback = true
      })

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function')
      await promised
      expect(ranCallback).to.equal(true, 'Should handle async callback')
    })

    it('Async transaction, auto commit', async () => {
      const id = chance.integer()
      const name = chance.name()
      const age = chance.integer()
      const networth = chance.floating()

      await testDb.transaction(async (tx) => {
        const res = await tx.executeAsync(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )

        expect(res.rowsAffected).to.equal(1)
        expect(res.insertId).to.equal(1)
        expect(res.rows?._array).to.eql([])
        expect(res.rows?.length).to.equal(0)
        expect(res.rows?.item).to.be.a('function')
      })

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ])
    })

    it('Async transaction, auto rollback', async () => {
      const id = chance.string() // Causes error because `id` should be an integer
      const name = chance.name()
      const age = chance.integer()
      const networth = chance.floating()

      try {
        await testDb.transaction(async (tx) => {
          await tx.executeAsync(
            'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
            [id, name, age, networth],
          )
        })
      } catch (e) {
        if (isNitroSQLiteError(e)) {
          expect(e.message)
            .to.include('SqlExecutionError')
            .and.to.include('cannot store TEXT value in REAL column User.id')

          const res = testDb.execute('SELECT * FROM User')
          expect(res.rows?._array).to.eql([])
        } else {
          expect.fail(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
        }
      }
    })

    it('Async transaction, manual commit', async () => {
      const id = chance.integer()
      const name = chance.name()
      const age = chance.integer()
      const networth = chance.floating()

      await testDb.transaction(async (tx) => {
        await tx.executeAsync(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )
        tx.commit()
      })

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).to.eql([
        {
          id,
          name,
          age,
          networth,
        },
      ])
    })

    it('Async transaction, manual rollback', async () => {
      const id = chance.integer()
      const name = chance.name()
      const age = chance.integer()
      const networth = chance.floating()

      await testDb.transaction(async (tx) => {
        await tx.executeAsync(
          'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)',
          [id, name, age, networth],
        )
        tx.rollback()
      })

      const res = testDb.execute('SELECT * FROM User')
      expect(res.rows?._array).to.eql([])
    })

    it('Async transaction, executed in order', async () => {
      // ARRANGE: Setup for multiple transactions
      const iterations = 10
      const actual: unknown[] = []

      // ARRANGE: Generate expected data
      const id = chance.integer()
      const name = chance.name()
      const age = chance.integer()

      // ACT: Start multiple async transactions to upsert and select the same record
      const promises = []
      for (let iteration = 1; iteration <= iterations; iteration++) {
        const promised = testDb.transaction(async (tx) => {
          // ACT: Upsert statement to create record / increment the value
          await tx.executeAsync(
            `
            INSERT OR REPLACE INTO [User] ([id], [name], [age], [networth])
            SELECT ?, ?, ?,
              IFNULL((
                SELECT [networth] + 1000
                FROM [User]
                WHERE [id] = ?
              ), 0)
        `,
            [id, name, age, id],
          )

          // ACT: Select statement to get incremented value and store it for checking later
          const results = await tx.executeAsync(
            'SELECT [networth] FROM [User] WHERE [id] = ?',
            [id],
          )

          const row = results.rows?._array[0] as User | undefined
          actual.push(row?.networth)
        })

        promises.push(promised)
      }

      // ACT: Wait for all transactions to complete
      await Promise.all(promises)

      // ASSERT: That the expected values where returned
      const expected = Array(iterations)
        .fill(0)
        .map((_, index) => index * 1000)
      expect(actual).to.eql(
        expected,
        'Each transaction should read a different value',
      )
    })

    it('Async transaction, rejects on callback error', async () => {
      const promised = testDb.transaction(() => {
        throw new Error(TEST_ERROR_MESSAGE)
      })

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function')
      try {
        await promised
        expect.fail(TEST_ERROR_CODES.EXPECT_PROMISE_REJECTION)
      } catch (e) {
        if (isNitroSQLiteError(e))
          expect(e.message).to.include(TEST_ERROR_MESSAGE)
        else expect.fail(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
      }
    })

    it('Async transaction, rejects on invalid query', async () => {
      const promised = testDb.transaction(async (tx) => {
        await tx.executeAsync('SELECT * FROM [tableThatDoesNotExist];')
      })

      // ASSERT: should return a promise that eventually rejects
      expect(promised).to.have.property('then').that.is.a('function')
      try {
        await promised
        expect.fail(TEST_ERROR_CODES.EXPECT_PROMISE_REJECTION)
      } catch (e) {
        if (isNitroSQLiteError(e))
          expect(e.message).to.include('no such table: tableThatDoesNotExist')
        else expect.fail(TEST_ERROR_CODES.EXPECT_NITRO_SQLITE_ERROR)
      }
    })
  })
}
