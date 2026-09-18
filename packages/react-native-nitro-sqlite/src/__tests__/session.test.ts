jest.mock('../nitro')

import { HybridNitroSQLite } from '../nitro'
import { closeDatabaseQueue, isDatabaseOpen } from '../DatabaseQueue'
import { open } from '../operations/session'
import { execute } from '../operations/execute'
import { deferred, nativeResult } from './testUtils'

const dbName = 'session-test'
const options = { name: dbName, location: 'data' }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(HybridNitroSQLite.execute).mockReturnValue(nativeResult())
  jest.mocked(HybridNitroSQLite.executeAsync).mockResolvedValue(nativeResult())
  jest.mocked(HybridNitroSQLite.isConnectionOpen).mockReturnValue(true)
})

afterEach(() => {
  if (isDatabaseOpen(dbName)) closeDatabaseQueue(dbName)
})

describe('open', () => {
  it('opens a native connection and routes its query and batch methods', async () => {
    const db = open(options)
    jest
      .mocked(HybridNitroSQLite.executeBatch)
      .mockReturnValue({ rowsAffected: 2 })
    jest.mocked(HybridNitroSQLite.executeBatchAsync).mockResolvedValue({
      rowsAffected: 3,
    })

    expect(HybridNitroSQLite.open).toHaveBeenCalledWith(dbName, 'data')
    expect(db.execute('SELECT 1').rows.length).toBe(0)
    expect((await db.executeAsync('SELECT 2')).rows.length).toBe(0)
    expect(db.executeBatch([{ query: 'INSERT 1' }])).toEqual({
      rowsAffected: 2,
    })
    await expect(
      db.executeBatchAsync([{ query: 'INSERT 2' }]),
    ).resolves.toEqual({
      rowsAffected: 3,
    })
    expect(HybridNitroSQLite.execute).toHaveBeenCalledWith(
      dbName,
      'SELECT 1',
      undefined,
    )
    expect(HybridNitroSQLite.executeAsync).toHaveBeenCalledWith(
      dbName,
      'SELECT 2',
      undefined,
    )

    db.close()
    expect(HybridNitroSQLite.close).toHaveBeenCalledWith(dbName)
    expect(isDatabaseOpen(dbName)).toBe(false)
  })

  it('delegates transactions through the connection', async () => {
    const db = open(options)
    await expect(
      db.transaction(async (tx) => tx.execute('SELECT 1').rows.length),
    ).resolves.toBe(0)
    expect(HybridNitroSQLite.executeAsync).toHaveBeenCalledWith(
      dbName,
      'BEGIN TRANSACTION',
      undefined,
    )
    expect(HybridNitroSQLite.execute).toHaveBeenCalledWith(
      dbName,
      'COMMIT',
      undefined,
    )
  })

  it('rejects duplicate opens without replacing the original connection', () => {
    const db = open(options)

    expect(() => open({ name: dbName, location: 'other' })).toThrow(
      'already open',
    )
    expect(HybridNitroSQLite.open).toHaveBeenCalledTimes(1)
    expect(db.execute('SELECT 1').rows.length).toBe(0)
  })

  it('cleans up the queue when native open fails', () => {
    jest.mocked(HybridNitroSQLite.open).mockImplementationOnce(() => {
      throw new Error('native open failed')
    })

    expect(() => open(options)).toThrow('native open failed')
    expect(isDatabaseOpen(dbName)).toBe(false)
    expect(open(options)).toBeDefined()
  })

  it('keeps the queue open if native close fails so close can be retried', () => {
    const db = open(options)
    jest.mocked(HybridNitroSQLite.close).mockImplementationOnce(() => {
      throw new Error('native close failed')
    })

    expect(() => db.close()).toThrow('native close failed')
    expect(isDatabaseOpen(dbName)).toBe(true)
    db.close()
    expect(isDatabaseOpen(dbName)).toBe(false)
  })

  it('deletes an open database and can delete again after closing', () => {
    const db = open(options)
    db.delete()

    expect(HybridNitroSQLite.drop).toHaveBeenCalledWith(dbName, 'data')
    expect(isDatabaseOpen(dbName)).toBe(false)
    db.delete()
    expect(HybridNitroSQLite.drop).toHaveBeenCalledTimes(2)
  })

  it('preserves the open queue when deletion fails', () => {
    const db = open(options)
    jest.mocked(HybridNitroSQLite.drop).mockImplementationOnce(() => {
      throw new Error('cannot delete')
    })

    expect(() => db.delete()).toThrow('cannot delete')
    expect(isDatabaseOpen(dbName)).toBe(true)
    expect(HybridNitroSQLite.isConnectionOpen).toHaveBeenCalledWith(dbName)
    db.delete()
    expect(isDatabaseOpen(dbName)).toBe(false)
  })

  it('releases the queue when deletion closes native before unlink fails', () => {
    const stale = open(options)
    jest.mocked(HybridNitroSQLite.drop).mockImplementationOnce(() => {
      throw new Error('unlink failed')
    })
    jest.mocked(HybridNitroSQLite.isConnectionOpen).mockReturnValueOnce(false)

    expect(() => stale.delete()).toThrow('unlink failed')
    expect(HybridNitroSQLite.isConnectionOpen).toHaveBeenCalledWith(dbName)
    expect(isDatabaseOpen(dbName)).toBe(false)

    const current = open(options)
    expect(() => stale.delete()).toThrow('reopened')
    current.close()
  })

  it('does not delete or inspect a connection while its queue is busy', async () => {
    const db = open(options)
    const gate = deferred<ReturnType<typeof nativeResult>>()
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockReturnValueOnce(gate.promise)
    const pending = db.executeAsync('SELECT waiting')

    expect(() => db.delete()).toThrow('busy')
    expect(HybridNitroSQLite.drop).not.toHaveBeenCalled()
    expect(HybridNitroSQLite.isConnectionOpen).not.toHaveBeenCalled()
    expect(isDatabaseOpen(dbName)).toBe(true)

    gate.resolve(nativeResult())
    await pending
    db.close()
  })

  it('passes attach, detach, and file loading through the native connection', async () => {
    const db = open(options)
    jest.mocked(HybridNitroSQLite.loadFile).mockReturnValue({ commands: 2 })
    jest
      .mocked(HybridNitroSQLite.loadFileAsync)
      .mockResolvedValue({ commands: 3 })

    db.attach('other', 'alias', 'external')
    db.detach('alias')
    expect(db.loadFile('/tmp/statements.sql')).toEqual({ commands: 2 })
    await expect(db.loadFileAsync('/tmp/statements.sql')).resolves.toEqual({
      commands: 3,
    })
    expect(HybridNitroSQLite.attach).toHaveBeenCalledWith(
      dbName,
      'other',
      'alias',
      'external',
    )
    expect(HybridNitroSQLite.detach).toHaveBeenCalledWith(dbName, 'alias')
    expect(HybridNitroSQLite.loadFile).toHaveBeenCalledWith(
      dbName,
      '/tmp/statements.sql',
    )
    expect(HybridNitroSQLite.loadFileAsync).toHaveBeenCalledWith(
      dbName,
      '/tmp/statements.sql',
    )
  })

  it('converts synchronous operation and asynchronous file errors', async () => {
    const db = open(options)
    jest.mocked(HybridNitroSQLite.attach).mockImplementationOnce(() => {
      throw new Error('attach failed')
    })
    jest
      .mocked(HybridNitroSQLite.loadFileAsync)
      .mockRejectedValueOnce('load failed')
      .mockResolvedValueOnce({ commands: 1 })

    expect(() => db.attach('other', 'alias')).toThrow('attach failed')
    await expect(db.loadFileAsync('/tmp/missing.sql')).rejects.toMatchObject({
      name: 'NitroSQLiteError',
      message: 'load failed',
    })
    await expect(db.loadFileAsync('/tmp/valid.sql')).resolves.toEqual({
      commands: 1,
    })
  })

  it('opens independent sessions for the same file with separate native IDs', () => {
    jest
      .mocked(HybridNitroSQLite.openConnection)
      .mockReturnValueOnce('connection-1')
      .mockReturnValueOnce('connection-2')
    const first = open({ ...options, connection: 'independent' })
    const second = open({ ...options, connection: 'independent' })

    expect(HybridNitroSQLite.openConnection).toHaveBeenNthCalledWith(
      1,
      dbName,
      'data',
    )
    expect(HybridNitroSQLite.openConnection).toHaveBeenNthCalledWith(
      2,
      dbName,
      'data',
    )
    first.execute('SELECT 1')
    second.execute('SELECT 2')
    expect(HybridNitroSQLite.execute).toHaveBeenNthCalledWith(
      1,
      'connection-1',
      'SELECT 1',
      undefined,
    )
    expect(HybridNitroSQLite.execute).toHaveBeenNthCalledWith(
      2,
      'connection-2',
      'SELECT 2',
      undefined,
    )

    first.close()
    expect(HybridNitroSQLite.close).toHaveBeenCalledWith('connection-1')
    second.execute('SELECT 3')
    second.close()
  })

  it('keeps independent queues separate during an entire transaction callback', async () => {
    jest
      .mocked(HybridNitroSQLite.openConnection)
      .mockReturnValueOnce('transaction-1')
      .mockReturnValueOnce('transaction-2')
    const first = open({ ...options, connection: 'independent' })
    const second = open({ ...options, connection: 'independent' })
    const gate = deferred<void>()
    const entered = deferred<void>()
    const transactionPromise = first.transaction(async (tx) => {
      entered.resolve()
      await gate.promise
      tx.execute('SELECT 1')
    })

    await entered.promise
    const pendingOnFirst = first.executeAsync('SELECT 2')
    await expect(second.executeAsync('SELECT 3')).resolves.toBeDefined()
    expect(HybridNitroSQLite.executeAsync).toHaveBeenCalledWith(
      'transaction-2',
      'SELECT 3',
      undefined,
    )
    expect(HybridNitroSQLite.executeAsync).not.toHaveBeenCalledWith(
      'transaction-1',
      'SELECT 2',
      undefined,
    )

    gate.resolve()
    await transactionPromise
    await pendingOnFirst
    first.close()
    second.close()
  })

  it('cleans up failed independent opens and forwards readOnly', () => {
    jest
      .mocked(HybridNitroSQLite.openConnection)
      .mockImplementationOnce(() => {
        throw new Error('independent open failed')
      })
      .mockReturnValueOnce('readonly-1')

    expect(() => open({ ...options, connection: 'independent' })).toThrow(
      'independent open failed',
    )
    const readOnly = open({
      ...options,
      connection: 'independent',
      readOnly: true,
    })
    expect(HybridNitroSQLite.openConnection).toHaveBeenLastCalledWith(
      dbName,
      'data',
      true,
    )
    expect(() => readOnly.delete()).toThrow('read-only')
    expect(HybridNitroSQLite.drop).not.toHaveBeenCalled()
    readOnly.close()

    const defaultReadOnly = open({ ...options, readOnly: true })
    expect(HybridNitroSQLite.open).toHaveBeenCalledWith(dbName, 'data', true)
    expect(() => defaultReadOnly.delete()).toThrow('read-only')
    defaultReadOnly.close()
  })

  it('passes an independent ID to delete, including after close', () => {
    jest
      .mocked(HybridNitroSQLite.openConnection)
      .mockReturnValueOnce('delete-1')
      .mockReturnValueOnce('delete-2')
    const first = open({ ...options, connection: 'independent' })
    const second = open({ ...options, connection: 'independent' })
    first.close()
    first.delete()
    expect(HybridNitroSQLite.drop).toHaveBeenCalledWith(
      dbName,
      'data',
      'delete-1',
    )
    expect(second.execute('SELECT 1')).toBeDefined()
    second.delete()
    expect(HybridNitroSQLite.drop).toHaveBeenCalledWith(
      dbName,
      'data',
      'delete-2',
    )
  })

  it('rejects stale default wrappers after the database is reopened', () => {
    const stale = open(options)
    stale.close()
    const current = open(options)

    expect(() => stale.execute('SELECT 1')).toThrow('not open')
    expect(() => stale.close()).toThrow('not open')
    expect(() => stale.delete()).toThrow('reopened')
    expect(HybridNitroSQLite.drop).not.toHaveBeenCalled()
    current.execute('SELECT 2')
    current.close()
  })

  it('isolates an independent queue when its native ID equals a default name', () => {
    jest.mocked(HybridNitroSQLite.openConnection).mockReturnValueOnce(dbName)
    const independent = open({ ...options, connection: 'independent' })
    const defaultConnection = open(options)

    independent.execute('SELECT independent')
    defaultConnection.execute('SELECT default')
    expect(HybridNitroSQLite.execute).toHaveBeenCalledTimes(2)

    independent.close()
    defaultConnection.execute('SELECT still open')
    defaultConnection.close()
  })

  it('keeps name-based calls on the default connection', () => {
    jest
      .mocked(HybridNitroSQLite.openConnection)
      .mockReturnValueOnce('other-id')
    const independent = open({ ...options, connection: 'independent' })
    const defaultConnection = open(options)

    execute(dbName, 'SELECT global')
    independent.execute('SELECT independent')
    expect(HybridNitroSQLite.execute).toHaveBeenNthCalledWith(
      1,
      dbName,
      'SELECT global',
      undefined,
    )
    expect(HybridNitroSQLite.execute).toHaveBeenNthCalledWith(
      2,
      'other-id',
      'SELECT independent',
      undefined,
    )

    defaultConnection.close()
    independent.close()
  })

  it('keeps readOnly protection if the options object changes later', () => {
    const readOnlyOptions = { ...options, readOnly: true }
    const db = open(readOnlyOptions)
    readOnlyOptions.readOnly = false

    expect(() => db.delete()).toThrow('read-only')
    db.close()
  })
})
