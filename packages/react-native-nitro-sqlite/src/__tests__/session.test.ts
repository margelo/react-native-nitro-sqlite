jest.mock('../nitro')

import { HybridNitroSQLite } from '../nitro'
import { closeDatabaseQueue, isDatabaseOpen } from '../DatabaseQueue'
import { open } from '../operations/session'
import { nativeResult } from './testUtils'

const dbName = 'session-test'
const options = { name: dbName, location: 'data' }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(HybridNitroSQLite.execute).mockReturnValue(nativeResult())
  jest.mocked(HybridNitroSQLite.executeAsync).mockResolvedValue(nativeResult())
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
    db.delete()
    expect(isDatabaseOpen(dbName)).toBe(false)
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
})
