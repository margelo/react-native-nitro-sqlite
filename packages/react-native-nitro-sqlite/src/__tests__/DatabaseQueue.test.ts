import {
  closeDatabaseQueue,
  getDatabaseQueue,
  isDatabaseOpen,
  openDatabaseQueue,
  queueOperationAsync,
  startOperationSync,
  throwIfDatabaseIsNotOpen,
} from '../DatabaseQueue'
import NitroSQLiteError from '../NitroSQLiteError'
import { deferred } from './testUtils'

const dbName = 'queue-test'

afterEach(() => {
  if (isDatabaseOpen(dbName)) closeDatabaseQueue(dbName)
})

describe('DatabaseQueue', () => {
  it('tracks open connections and rejects duplicate or missing connections', () => {
    expect(isDatabaseOpen(dbName)).toBe(false)
    expect(() => throwIfDatabaseIsNotOpen(dbName)).toThrow(NitroSQLiteError)
    expect(() => getDatabaseQueue(dbName)).toThrow('not open')
    expect(() => closeDatabaseQueue(dbName)).toThrow('not open')

    openDatabaseQueue(dbName)
    expect(isDatabaseOpen(dbName)).toBe(true)
    expect(getDatabaseQueue(dbName)).toEqual({ queue: [], inProgress: false })
    expect(() => openDatabaseQueue(dbName)).toThrow('already open')

    closeDatabaseQueue(dbName)
    expect(isDatabaseOpen(dbName)).toBe(false)
  })

  it('runs synchronous work and releases the queue after a throw', () => {
    openDatabaseQueue(dbName)
    expect(startOperationSync(dbName, () => 42)).toBe(42)
    expect(() =>
      startOperationSync(dbName, () => {
        throw new Error('callback failed')
      }),
    ).toThrow('callback failed')
    expect(getDatabaseQueue(dbName).inProgress).toBe(false)
    expect(startOperationSync(dbName, () => 'available')).toBe('available')
  })

  it('rejects nested synchronous operations and closing a busy queue', () => {
    openDatabaseQueue(dbName)

    startOperationSync(dbName, () => {
      expect(() => startOperationSync(dbName, () => 1)).toThrow('busy')
      expect(() => closeDatabaseQueue(dbName)).toThrow('busy')
    })
  })

  it('runs async operations in order, including after a rejection', async () => {
    openDatabaseQueue(dbName)
    const first = deferred<void>()
    const started: number[] = []
    const one = queueOperationAsync(dbName, async () => {
      started.push(1)
      await first.promise
      throw new Error('first failed')
    })
    const two = queueOperationAsync(dbName, async () => {
      started.push(2)
      return 2
    })
    const three = queueOperationAsync(dbName, async () => {
      started.push(3)
      return 3
    })

    expect(getDatabaseQueue(dbName).queue).toHaveLength(2)
    expect(() => closeDatabaseQueue(dbName)).toThrow('busy')
    expect(() => startOperationSync(dbName, () => 0)).toThrow('busy')
    first.resolve()

    await expect(one).rejects.toThrow('first failed')
    await expect(two).resolves.toBe(2)
    await expect(three).resolves.toBe(3)
    expect(started).toEqual([1, 2, 3])
    expect(getDatabaseQueue(dbName)).toEqual({ queue: [], inProgress: false })
  })

  it('keeps queues for different databases independent', async () => {
    openDatabaseQueue(dbName)
    openDatabaseQueue('other')
    try {
      const pending = deferred<void>()
      const first = queueOperationAsync(dbName, () => pending.promise)
      await expect(queueOperationAsync('other', async () => 7)).resolves.toBe(7)
      pending.resolve()
      await first
    } finally {
      closeDatabaseQueue('other')
    }
  })
})
