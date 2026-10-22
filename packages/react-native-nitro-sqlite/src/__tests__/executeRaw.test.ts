jest.mock('../nitro')

import { NitroSQLite } from '../index'
import { HybridNitroSQLite } from '../nitro'
import {
  closeDatabaseQueue,
  isDatabaseOpen,
  openDatabaseQueue,
} from '../DatabaseQueue'
import NitroSQLiteError from '../NitroSQLiteError'
import { deferred, nativeRawResult, nativeResult } from './testUtils'

const dbName = 'execute-raw-test'
const query = 'SELECT ? AS value'
const raw = nativeRawResult(['value'], [[7]])

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(HybridNitroSQLite.executeRaw).mockReturnValue(raw)
  jest.mocked(HybridNitroSQLite.executeRawAsync).mockResolvedValue(raw)
  jest.mocked(HybridNitroSQLite.execute).mockReturnValue(nativeResult())
  jest.mocked(HybridNitroSQLite.executeAsync).mockResolvedValue(nativeResult())
})

afterEach(() => {
  if (isDatabaseOpen(dbName)) closeDatabaseQueue(dbName)
})

it('forwards unmanaged raw queries and parameters without adapting their rows', async () => {
  expect(NitroSQLite.executeRaw(dbName, query, [7])).toBe(raw)
  await expect(NitroSQLite.executeRawAsync(dbName, query, [7])).resolves.toBe(
    raw,
  )
  expect(HybridNitroSQLite.executeRaw).toHaveBeenCalledWith(dbName, query, [7])
  expect(HybridNitroSQLite.executeRawAsync).toHaveBeenCalledWith(
    dbName,
    query,
    [7],
  )
})

it('rejects global synchronous raw queries while managed work is pending', async () => {
  openDatabaseQueue(dbName)
  expect(NitroSQLite.executeRaw(dbName, query)).toBe(raw)

  const gate = deferred<typeof raw>()
  jest
    .mocked(HybridNitroSQLite.executeRawAsync)
    .mockReturnValueOnce(gate.promise)
  const pending = NitroSQLite.executeRawAsync(dbName, query)
  try {
    expect(() => NitroSQLite.executeRaw(dbName, 'SELECT blocked')).toThrow(
      'busy',
    )
    expect(HybridNitroSQLite.executeRaw).toHaveBeenCalledTimes(1)
  } finally {
    gate.resolve(raw)
    await pending
  }
})

it('keeps global raw queries outside an active managed transaction', async () => {
  openDatabaseQueue(dbName)
  const entered = deferred<void>()
  const finish = deferred<void>()
  const transaction = NitroSQLite.transaction(dbName, async () => {
    entered.resolve()
    await finish.promise
  })
  await entered.promise

  const pending = NitroSQLite.executeRawAsync(dbName, query)
  try {
    expect(() => NitroSQLite.executeRaw(dbName, query)).toThrow('busy')
    expect(HybridNitroSQLite.executeRaw).not.toHaveBeenCalled()
    expect(HybridNitroSQLite.executeRawAsync).not.toHaveBeenCalled()
  } finally {
    finish.resolve()
    await transaction
    await pending
  }
  expect(HybridNitroSQLite.executeRawAsync).toHaveBeenCalledWith(
    dbName,
    query,
    undefined,
  )
  expect(
    jest.mocked(HybridNitroSQLite.execute).mock.invocationCallOrder[0],
  ).toBeLessThan(
    jest.mocked(HybridNitroSQLite.executeRawAsync).mock.invocationCallOrder[0]!,
  )
})

it('normalizes native errors and releases the managed queue after failure', async () => {
  openDatabaseQueue(dbName)
  jest.mocked(HybridNitroSQLite.executeRaw).mockImplementationOnce(() => {
    throw new Error('raw failed')
  })
  expect(() => NitroSQLite.executeRaw(dbName, query)).toThrow(NitroSQLiteError)
  expect(NitroSQLite.executeRaw(dbName, query)).toBe(raw)

  jest
    .mocked(HybridNitroSQLite.executeRawAsync)
    .mockRejectedValueOnce('raw async failed')
  await expect(
    NitroSQLite.executeRawAsync(dbName, query),
  ).rejects.toMatchObject({
    name: 'NitroSQLiteError',
    message: 'raw async failed',
  })
  await expect(NitroSQLite.executeRawAsync(dbName, query)).resolves.toBe(raw)
})
