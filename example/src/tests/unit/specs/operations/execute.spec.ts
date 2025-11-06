import { chance, expect, isNitroSQLiteError } from '../../common'
import {
  enableSimpleNullHandling,
  NITRO_SQLITE_NULL,
} from 'react-native-nitro-sqlite'
import { describe, it } from '../../../MochaRNAdapter'
import { testDb } from '../../../db'

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
        const age = NITRO_SQLITE_NULL
        const networth = NITRO_SQLITE_NULL
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

      it('Insert with null (simple null handling)', () => {
        enableSimpleNullHandling(true)

        const id = chance.integer()
        const name = chance.name()
        const age = undefined
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
            age: null,
            networth: null,
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
          expect(e).to.not.equal(undefined)
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
  })
}
