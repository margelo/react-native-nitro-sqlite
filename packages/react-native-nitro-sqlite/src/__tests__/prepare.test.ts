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
import { nativeRawResult, nativeResult } from './testUtils'

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
    executeRaw: jest.fn(() => nativeRawResult(['value'], [[9]])),
    executeRawAsync: jest.fn(async () => nativeRawResult(['value'], [[10]])),
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

it('prepares against an independent connection ID', () => {
  jest
    .mocked(HybridNitroSQLite.openConnection)
    .mockReturnValue('prepared-connection')
  const native = mockStatement()
  jest.mocked(HybridNitroSQLite.prepare).mockReturnValue(native)
  const db = open({ name: dbName, connection: 'independent' })

  const statement = db.prepare(query)

  expect(HybridNitroSQLite.prepare).toHaveBeenCalledWith(
    'prepared-connection',
    query,
  )
  statement.finalize()
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

it('runs raw executions through the statement queue', async () => {
  const native = mockStatement()
  jest.mocked(HybridNitroSQLite.prepare).mockReturnValue(native)
  const statement = prepare(dbName, query)

  expect(statement.executeRaw([9]).rows).toEqual([[9]])
  const pending = statement.executeRawAsync([10])
  expect(() => statement.executeRaw()).toThrow('busy with another operation')
  await expect(pending).resolves.toMatchObject({
    columnNames: ['value'],
    rows: [[10]],
  })
  expect(native.executeRaw).toHaveBeenCalledWith([9])
  expect(native.executeRawAsync).toHaveBeenCalledWith([10])

  jest.mocked(native.executeRaw).mockImplementationOnce(() => {
    throw new Error('raw failed')
  })
  expect(() => statement.executeRaw()).toThrow('raw failed')
  jest.mocked(native.executeRawAsync).mockRejectedValueOnce('async raw failed')
  await expect(statement.executeRawAsync()).rejects.toMatchObject({
    name: 'NitroSQLiteError',
    message: 'async raw failed',
  })
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
