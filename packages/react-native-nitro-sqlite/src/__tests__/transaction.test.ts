jest.mock('../nitro')

import { HybridNitroSQLite } from '../nitro'
import { closeDatabaseQueue, openDatabaseQueue } from '../DatabaseQueue'
import { transaction } from '../operations/transaction'
import { deferred, nativeResult } from './testUtils'

const dbName = 'transaction-test'

beforeEach(() => {
  jest.clearAllMocks()
  openDatabaseQueue(dbName)
  jest.mocked(HybridNitroSQLite.execute).mockReturnValue(nativeResult())
  jest.mocked(HybridNitroSQLite.executeAsync).mockResolvedValue(nativeResult())
})

afterEach(() => closeDatabaseQueue(dbName))

describe('transaction', () => {
  it('requires an open database', async () => {
    closeDatabaseQueue(dbName)
    await expect(transaction(dbName, async () => {})).rejects.toThrow(
      'not open',
    )
    openDatabaseQueue(dbName)
  })

  it('begins a normal transaction, runs queries, commits, and returns the callback result', async () => {
    const result = await transaction(dbName, async (tx) => {
      expect(tx.execute('SELECT ?', [1]).rows.length).toBe(0)
      expect((await tx.executeAsync('SELECT ?', [2])).rows.length).toBe(0)
      return 'finished'
    })

    expect(result).toBe('finished')
    expect(HybridNitroSQLite.executeAsync).toHaveBeenNthCalledWith(
      1,
      dbName,
      'BEGIN TRANSACTION',
      undefined,
    )
    expect(HybridNitroSQLite.execute).toHaveBeenNthCalledWith(
      1,
      dbName,
      'SELECT ?',
      [1],
    )
    expect(HybridNitroSQLite.executeAsync).toHaveBeenNthCalledWith(
      2,
      dbName,
      'SELECT ?',
      [2],
    )
    expect(HybridNitroSQLite.execute).toHaveBeenLastCalledWith(
      dbName,
      'COMMIT',
      undefined,
    )
  })

  it('starts an exclusive transaction and does not commit after an explicit commit', async () => {
    await transaction(
      dbName,
      async (tx) => {
        tx.commit()
        expect(() => tx.commit()).toThrow('finalized transaction')
        expect(() => tx.rollback()).toThrow('finalized transaction')
        expect(() => tx.execute('SELECT 1')).toThrow('finalized transaction')
        expect(() => tx.executeAsync('SELECT 1')).toThrow(
          'finalized transaction',
        )
      },
      true,
    )

    expect(HybridNitroSQLite.executeAsync).toHaveBeenCalledWith(
      dbName,
      'BEGIN EXCLUSIVE TRANSACTION',
      undefined,
    )
    expect(HybridNitroSQLite.execute).toHaveBeenCalledTimes(1)
    expect(HybridNitroSQLite.execute).toHaveBeenCalledWith(
      dbName,
      'COMMIT',
      undefined,
    )
  })

  it('does not commit after an explicit rollback', async () => {
    await transaction(dbName, async (tx) => {
      tx.rollback()
      expect(() => tx.rollback()).toThrow('finalized transaction')
    })

    expect(HybridNitroSQLite.execute).toHaveBeenCalledTimes(1)
    expect(HybridNitroSQLite.execute).toHaveBeenCalledWith(
      dbName,
      'ROLLBACK',
      undefined,
    )
  })

  it('rolls back when the callback fails', async () => {
    await expect(
      transaction(dbName, async () => {
        throw new Error('callback failed')
      }),
    ).rejects.toMatchObject({
      name: 'NitroSQLiteError',
      message: 'callback failed',
    })
    expect(HybridNitroSQLite.execute).toHaveBeenCalledWith(
      dbName,
      'ROLLBACK',
      undefined,
    )
  })

  it('converts a rollback failure when handling a callback error', async () => {
    jest.mocked(HybridNitroSQLite.execute).mockImplementation(() => {
      throw new Error('rollback failed')
    })

    await expect(
      transaction(dbName, async () => {
        throw new Error('callback failed')
      }),
    ).rejects.toMatchObject({
      name: 'NitroSQLiteError',
      message: 'rollback failed',
    })
  })

  it('does not roll back a transaction already committed before a callback error', async () => {
    await expect(
      transaction(dbName, async (tx) => {
        tx.commit()
        throw new Error('after commit')
      }),
    ).rejects.toThrow('after commit')
    expect(HybridNitroSQLite.execute).toHaveBeenCalledTimes(1)
  })

  it('serializes transactions behind the same queue', async () => {
    const firstMayFinish = deferred<void>()
    const order: string[] = []
    const first = transaction(dbName, async () => {
      order.push('first')
      await firstMayFinish.promise
    })
    const second = transaction(dbName, async () => {
      order.push('second')
    })

    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(order).toEqual(['first'])
    firstMayFinish.resolve()
    await Promise.all([first, second])
    expect(order).toEqual(['first', 'second'])
  })
})
