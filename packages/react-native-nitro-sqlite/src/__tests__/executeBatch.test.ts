jest.mock('../nitro')

import { HybridNitroSQLite } from '../nitro'
import { closeDatabaseQueue, openDatabaseQueue } from '../DatabaseQueue'
import NitroSQLiteError from '../NitroSQLiteError'
import { executeBatch, executeBatchAsync } from '../operations/executeBatch'

const dbName = 'batch-test'
const commands = [{ query: 'INSERT INTO item VALUES (?)', params: [1] }]

beforeEach(() => jest.clearAllMocks())

afterEach(() => {
  try {
    closeDatabaseQueue(dbName)
  } catch (error) {
    if (
      !(error instanceof NitroSQLiteError) ||
      !error.message.includes('not open')
    ) {
      throw error
    }
  }
})

describe('executeBatch', () => {
  it('requires an open database before calling native code', async () => {
    expect(() => executeBatch(dbName, commands)).toThrow('not open')
    await expect(executeBatchAsync(dbName, commands)).rejects.toThrow(
      'not open',
    )
    expect(HybridNitroSQLite.executeBatch).not.toHaveBeenCalled()
    expect(HybridNitroSQLite.executeBatchAsync).not.toHaveBeenCalled()
  })

  it('passes commands and results through synchronous and asynchronous calls', async () => {
    openDatabaseQueue(dbName)
    jest
      .mocked(HybridNitroSQLite.executeBatch)
      .mockReturnValue({ rowsAffected: 2 })
    jest.mocked(HybridNitroSQLite.executeBatchAsync).mockResolvedValue({
      rowsAffected: 3,
    })

    expect(executeBatch(dbName, commands)).toEqual({ rowsAffected: 2 })
    await expect(executeBatchAsync(dbName, commands)).resolves.toEqual({
      rowsAffected: 3,
    })
    expect(HybridNitroSQLite.executeBatch).toHaveBeenCalledWith(
      dbName,
      commands,
    )
    expect(HybridNitroSQLite.executeBatchAsync).toHaveBeenCalledWith(
      dbName,
      commands,
    )
  })

  it('converts synchronous and asynchronous errors and releases the queue', async () => {
    openDatabaseQueue(dbName)
    jest.mocked(HybridNitroSQLite.executeBatch).mockImplementation(() => {
      throw new Error('sync failed')
    })
    jest
      .mocked(HybridNitroSQLite.executeBatchAsync)
      .mockRejectedValueOnce('async failed')
      .mockResolvedValueOnce({ rowsAffected: 1 })

    expect(() => executeBatch(dbName, commands)).toThrow(NitroSQLiteError)
    expect(() => executeBatch(dbName, commands)).toThrow('sync failed')
    await expect(executeBatchAsync(dbName, commands)).rejects.toMatchObject({
      name: 'NitroSQLiteError',
      message: 'async failed',
    })
    await expect(executeBatchAsync(dbName, commands)).resolves.toEqual({
      rowsAffected: 1,
    })
  })
})
