import { chance, expect, isNitroSQLiteError } from '../../common'
import { describe, it } from '../../../MochaRNAdapter'
import { createArrayBufferTestDb, testDb } from '../../../db'

export default function registerExecuteUnitTests() {
  describe('execute', () => {
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

        expect(res.rowsAffected).to.equal(1)
        expect(res.insertId).to.equal(1)
        expect(res.rows?._array).to.eql([])
        expect(res.rows?.length).to.equal(0)
        expect(res.rows?.item).to.be.a('function')
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

        expect(res.rowsAffected).to.equal(1)
        expect(res.insertId).to.equal(1)
        expect(res.rows?._array).to.eql([])
        expect(res.rows?.length).to.equal(0)
        expect(res.rows?.item).to.be.a('function')

        const selectRes = testDb.execute('SELECT * FROM User')
        expect(selectRes.rows?._array).to.eql([
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
            expect(e.message).to.include(
              'cannot store TEXT value in REAL column User.age',
            )
          } else {
            expect.fail('Should have thrown a valid NitroSQLiteException')
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
          expect(e).to.not.equal(null)
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

        expect(res.rowsAffected).to.equal(1)
        expect(res.insertId).to.equal(1)
        expect(res.rows?._array).to.eql([
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

        expect(res.rowsAffected).to.equal(1)
        expect(res.insertId).to.equal(1)
        expect(res.rows?._array).to.eql([
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

            expect(result.rowsAffected).to.equal(1)
            expect(result.rows?.length).to.equal(1)

            const row = result.results[0]
            // const row = result.rows?.item(0)
            expect(row).to.not.equal(undefined)

            const value = row?.data
            expect(value).to.be.instanceOf(ArrayBuffer)

            const returnedBytes = new Uint8Array(value as ArrayBuffer)
            expect(Array.from(returnedBytes)).to.eql(Array.from(originalBytes))
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

            expect(result.rowsAffected).to.equal(1)
            expect(result.rows?.length).to.equal(1)

            const row = result.results[0]
            // const row = result.rows?.item(0)
            expect(row).to.not.equal(undefined)

            const value = row?.data
            expect(value).to.be.instanceOf(ArrayBuffer)

            const returnedBytes = new Uint8Array(value as ArrayBuffer)
            expect(Array.from(returnedBytes)).to.eql(Array.from(originalBytes))
          } finally {
            db.close()
            db.delete()
          }
        })
      })
    })
  })
}
