jest.mock('../nitro')

import { HybridNitroSQLite } from '../nitro'
import {
  closeDatabaseQueue,
  isDatabaseOpen,
  openDatabaseQueue,
} from '../DatabaseQueue'
import type { NitroSQLitePreparedStatement } from '../specs/NitroSQLitePreparedStatement.nitro'
import { prepare } from '../operations/prepare'
import { open } from '../operations/session'
import { nativeResult } from './testUtils'

const dbName = 'prepare-test'
const query = 'SELECT ? AS value'

beforeEach(() => {
  jest.clearAllMocks()
  openDatabaseQueue(dbName)
})

afterEach(() => {
  if (isDatabaseOpen(dbName)) closeDatabaseQueue(dbName)
})

function mockStatement(): NitroSQLitePreparedStatement {
  let finalized = false
  return {
    name: 'PreparedStatement',
    toString: () => 'PreparedStatement',
    equals: () => false,
    dispose: jest.fn(),
    get isFinalized() {
      return finalized
    },
    execute: jest.fn(() => nativeResult([{ value: 7 }])),
    executeAsync: jest.fn(async () => nativeResult([{ value: 8 }])),
    finalize: jest.fn(() => {
      finalized = true
    }),
  }
}

it('reuses a statement, returns rows, and exposes finalization', async () => {
  closeDatabaseQueue(dbName)
  const db = open({ name: dbName })
  const native = mockStatement()
  jest.mocked(HybridNitroSQLite.prepare).mockReturnValue(native)

  const statement = db.prepare(query)
  expect(HybridNitroSQLite.prepare).toHaveBeenCalledWith(dbName, query)
  expect(statement.isFinalized).toBe(false)
  expect(statement.execute([7]).rows.item(0)).toEqual({ value: 7 })
  expect((await statement.executeAsync([8])).rows.item(0)).toEqual({
    value: 8,
  })
  expect(native.execute).toHaveBeenCalledWith([7])
  expect(native.executeAsync).toHaveBeenCalledWith([8])

  statement.finalize()
  expect(statement.isFinalized).toBe(true)
  expect(native.finalize).toHaveBeenCalledTimes(1)
  db.close()
})

it('keeps synchronous calls from overtaking an asynchronous execution', async () => {
  const native = mockStatement()
  jest.mocked(HybridNitroSQLite.prepare).mockReturnValue(native)
  const statement = prepare(dbName, query)

  const pending = statement.executeAsync()
  expect(() => statement.execute()).toThrow('busy with another operation')
  expect(() => statement.finalize()).toThrow('busy with another operation')
  await pending

  expect(statement.execute().rows.length).toBe(1)
  statement.finalize()
})

it('converts preparation and execution errors', async () => {
  jest.mocked(HybridNitroSQLite.prepare).mockImplementationOnce(() => {
    throw new Error('prepare failed')
  })
  expect(() => prepare(dbName, query)).toThrow('prepare failed')

  const native = mockStatement()
  jest.mocked(HybridNitroSQLite.prepare).mockReturnValue(native)
  const statement = prepare(dbName, query)

  jest.mocked(native.execute).mockImplementationOnce(() => {
    throw new Error('execute failed')
  })
  expect(() => statement.execute()).toThrow('execute failed')

  jest.mocked(native.executeAsync).mockRejectedValueOnce('async failed')
  await expect(statement.executeAsync()).rejects.toMatchObject({
    name: 'NitroSQLiteError',
    message: 'async failed',
  })
  await expect(statement.executeAsync()).resolves.toMatchObject({
    rows: { length: 1 },
  })

  jest.mocked(native.finalize).mockImplementationOnce(() => {
    throw new Error('finalize failed')
  })
  expect(() => statement.finalize()).toThrow('finalize failed')
})
