jest.mock('../nitro')

import Database from 'better-sqlite3'
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
      expect.any(Function),
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
      expect.any(Function),
    )
    expect(HybridNitroSQLite.execute).toHaveBeenLastCalledWith(
      dbName,
      'COMMIT',
      undefined,
    )
  })

  it('rejects synchronous transaction work until earlier async queries settle', async () => {
    const pendingQuery = deferred<ReturnType<typeof nativeResult>>()
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockImplementation((_name, query) =>
        query === 'SELECT pending'
          ? pendingQuery.promise
          : Promise.resolve(nativeResult()),
      )

    await transaction(dbName, async (tx) => {
      const pending = tx.executeAsync('SELECT pending')
      expect(() => tx.execute('SELECT sync')).toThrow(
        'Await all tx.executeAsync',
      )
      expect(() => tx.commit()).toThrow('Await all tx.executeAsync')
      expect(() => tx.rollback()).toThrow('Await all tx.executeAsync')

      pendingQuery.resolve(nativeResult())
      await pending
      expect(tx.execute('SELECT sync').rows.length).toBe(0)
    })

    expect(HybridNitroSQLite.execute).toHaveBeenLastCalledWith(
      dbName,
      'COMMIT',
      undefined,
    )
  })

  it('waits for unawaited async queries before rolling back', async () => {
    const pendingQuery = deferred<ReturnType<typeof nativeResult>>()
    const queryStarted = deferred<void>()
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockImplementation((_name, query) =>
        query === 'SELECT pending'
          ? pendingQuery.promise
          : Promise.resolve(nativeResult()),
      )

    const pendingTransaction = transaction(dbName, async (tx) => {
      tx.executeAsync('SELECT pending')
      queryStarted.resolve()
    })
    await queryStarted.promise
    expect(HybridNitroSQLite.execute).not.toHaveBeenCalled()

    pendingQuery.resolve(nativeResult())
    await expect(pendingTransaction).rejects.toThrow(
      'Await all tx.executeAsync',
    )
    expect(HybridNitroSQLite.execute).toHaveBeenCalledTimes(1)
    expect(HybridNitroSQLite.execute).toHaveBeenCalledWith(
      dbName,
      'ROLLBACK',
      undefined,
    )
  })

  it('rolls back after an async query rejects', async () => {
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockImplementation((_name, query) =>
        query === 'SELECT failed'
          ? Promise.reject(new Error('query failed'))
          : Promise.resolve(nativeResult()),
      )

    await expect(
      transaction(dbName, async (tx) => {
        await tx.executeAsync('SELECT failed')
      }),
    ).rejects.toThrow('query failed')
    expect(HybridNitroSQLite.execute).toHaveBeenCalledWith(
      dbName,
      'ROLLBACK',
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
      expect.any(Function),
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
      message: 'callback failed\nRollback failed: rollback failed',
      cause: expect.any(AggregateError),
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
  it.each(['automatic', 'manual', 'caught manual'])(
    'rolls back a real deferred constraint after a %s commit failure',
    async (mode) => {
      const sqlite = new Database(':memory:')
      sqlite.exec(
        'PRAGMA foreign_keys = ON; CREATE TABLE Parent (id INTEGER PRIMARY KEY); CREATE TABLE Child (parentId INTEGER REFERENCES Parent(id) DEFERRABLE INITIALLY DEFERRED)',
      )
      const execute = (_name: string, query: string) => {
        try {
          sqlite.exec(query)
          return nativeResult()
        } catch (error) {
          // The addon creates errors outside Jest's realm. The native bridge
          // exposes a JavaScript Error, so mirror that boundary here.
          if (
            typeof error === 'object' &&
            error !== null &&
            'message' in error &&
            typeof error.message === 'string'
          ) {
            throw new Error(error.message, { cause: error })
          }
          throw error
        }
      }
      jest.mocked(HybridNitroSQLite.execute).mockImplementation(execute)
      jest
        .mocked(HybridNitroSQLite.executeAsync)
        .mockImplementation(async (name, query) => execute(name, query))
      try {
        await expect(
          transaction(dbName, async (tx) => {
            tx.execute('INSERT INTO Child VALUES (1)')
            if (mode === 'manual') tx.commit()
            if (mode === 'caught manual') {
              expect(() => tx.commit()).toThrow('FOREIGN KEY constraint failed')
              expect(() => tx.execute('SELECT 1')).toThrow(
                'finalized transaction',
              )
              expect(() => tx.executeAsync('SELECT 1')).toThrow(
                'finalized transaction',
              )
              expect(() => tx.commit()).toThrow('finalized transaction')
            }
          }),
        ).rejects.toThrow('FOREIGN KEY constraint failed')
        expect(sqlite.inTransaction).toBe(false)
        expect(
          sqlite.prepare('SELECT COUNT(*) AS count FROM Child').get(),
        ).toEqual({ count: 0 })
        await transaction(dbName, async (tx) => {
          tx.execute('INSERT INTO Parent VALUES (1)')
        })
        expect(sqlite.inTransaction).toBe(false)
      } finally {
        sqlite.close()
      }
    },
  )

  it('allows explicit rollback to recover a caught commit failure', async () => {
    jest
      .mocked(HybridNitroSQLite.execute)
      .mockImplementation((_name, query) => {
        if (query === 'COMMIT') throw new Error('commit failed')
        return nativeResult()
      })
    await expect(
      transaction(dbName, async (tx) => {
        expect(() => tx.commit()).toThrow('commit failed')
        tx.rollback()
        return 'recovered'
      }),
    ).resolves.toBe('recovered')
  })

  it.each([false, true])(
    'rejects a failed manual rollback even when caught: %s',
    async (caught) => {
      jest.mocked(HybridNitroSQLite.execute).mockImplementation(() => {
        throw new Error('rollback failed')
      })
      await expect(
        transaction(dbName, async (tx) => {
          if (caught) {
            expect(() => tx.rollback()).toThrow('rollback failed')
            return
          }
          tx.rollback()
        }),
      ).rejects.toThrow('rollback failed')
      expect(HybridNitroSQLite.execute).toHaveBeenCalledTimes(1)
    },
  )

  it('preserves commit and rollback errors in order', async () => {
    jest
      .mocked(HybridNitroSQLite.execute)
      .mockImplementation((_name, query) => {
        throw new Error(
          query === 'COMMIT' ? 'commit failed' : 'rollback failed',
        )
      })
    await expect(transaction(dbName, async () => {})).rejects.toMatchObject({
      message: 'commit failed\nRollback failed: rollback failed',
      cause: {
        errors: [
          expect.objectContaining({ message: 'commit failed' }),
          expect.objectContaining({ message: 'rollback failed' }),
        ],
      },
    })
  })

  it('preserves both errors when manual rollback after a failed commit also fails', async () => {
    jest
      .mocked(HybridNitroSQLite.execute)
      .mockImplementation((_name, query) => {
        throw new Error(
          query === 'COMMIT' ? 'commit failed' : 'rollback failed',
        )
      })
    await expect(
      transaction(dbName, async (tx) => {
        expect(() => tx.commit()).toThrow('commit failed')
        expect(() => tx.rollback()).toThrow('rollback failed')
      }),
    ).rejects.toMatchObject({
      message: 'commit failed\nRollback failed: rollback failed',
      cause: {
        errors: [
          expect.objectContaining({ message: 'commit failed' }),
          expect.objectContaining({ message: 'rollback failed' }),
        ],
      },
    })
    expect(HybridNitroSQLite.execute).toHaveBeenCalledTimes(2)
  })

  it('does not roll back when BEGIN fails', async () => {
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockRejectedValue(new Error('begin failed'))
    const callback = jest.fn()
    await expect(transaction(dbName, callback)).rejects.toThrow('begin failed')
    expect(callback).not.toHaveBeenCalled()
    expect(HybridNitroSQLite.execute).not.toHaveBeenCalled()
  })
})
