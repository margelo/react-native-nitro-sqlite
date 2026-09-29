jest.mock('../nitro')

import { HybridNitroSQLite } from '../nitro'
import { closeDatabaseQueue, isDatabaseOpen } from '../DatabaseQueue'
import { typeORMDriver } from '../typeORM'
import { nativeResult } from './testUtils'

const dbName = 'typeorm-test'

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(HybridNitroSQLite.execute).mockReturnValue(nativeResult())
  jest
    .mocked(HybridNitroSQLite.executeAsync)
    .mockResolvedValue(nativeResult([{ id: 1 }]))
})

afterEach(() => {
  if (isDatabaseOpen(dbName)) closeDatabaseQueue(dbName)
})

describe('typeORMDriver', () => {
  it('opens a connection and forwards successful query, transaction, attachment, and close callbacks', async () => {
    const opened = jest.fn()
    const failed = jest.fn()
    const connection = typeORMDriver.openDatabase(
      { name: dbName },
      opened,
      failed,
    )
    if (!connection) throw new Error('expected an open connection')

    const querySucceeded = jest.fn()
    const queryFailed = jest.fn()
    await connection.executeSql(
      'SELECT id FROM item',
      [],
      querySucceeded,
      queryFailed,
    )
    expect(querySucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        rows: { _array: [{ id: 1 }], length: 1, item: expect.any(Function) },
      }),
    )
    expect(queryFailed).not.toHaveBeenCalled()

    await connection.transaction(async (tx) => {
      tx.execute('SELECT 1')
    })
    const attached = jest.fn()
    const detached = jest.fn()
    connection.attach('other', 'alias', undefined, attached)
    connection.detach('alias', detached)
    expect(attached).toHaveBeenCalledTimes(1)
    expect(detached).toHaveBeenCalledTimes(1)
    expect(HybridNitroSQLite.attach).toHaveBeenCalledWith(
      dbName,
      'other',
      'alias',
      undefined,
    )
    expect(HybridNitroSQLite.detach).toHaveBeenCalledWith(dbName, 'alias')

    const closed = jest.fn()
    const closeFailed = jest.fn()
    connection.close(closed, closeFailed)
    expect(closed).toHaveBeenCalledTimes(1)
    expect(closeFailed).not.toHaveBeenCalled()
    expect(opened).toHaveBeenCalledWith(connection)
    expect(failed).not.toHaveBeenCalled()
  })

  it('forwards query and close errors to their failure callbacks', async () => {
    const connection = typeORMDriver.openDatabase(
      { name: dbName },
      jest.fn(),
      jest.fn(),
    )
    if (!connection) throw new Error('expected an open connection')
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockRejectedValueOnce(new Error('query failed'))
    const queryFailed = jest.fn()

    await connection.executeSql('INVALID', undefined, jest.fn(), queryFailed)
    expect(queryFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'NitroSQLiteError',
        message: 'query failed',
      }),
    )

    jest.mocked(HybridNitroSQLite.close).mockImplementationOnce(() => {
      throw new Error('close failed')
    })
    const closeFailed = jest.fn()
    connection.close(jest.fn(), closeFailed)
    expect(closeFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'NitroSQLiteError',
        message: 'close failed',
      }),
    )
    expect(isDatabaseOpen(dbName)).toBe(true)
    connection.close(jest.fn(), jest.fn())
  })

  it('reports an open failure and returns null', () => {
    jest.mocked(HybridNitroSQLite.open).mockImplementationOnce(() => {
      throw new Error('open failed')
    })
    const opened = jest.fn()
    const failed = jest.fn()

    expect(
      typeORMDriver.openDatabase({ name: dbName }, opened, failed),
    ).toBeNull()
    expect(opened).not.toHaveBeenCalled()
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'NitroSQLiteError',
        message: 'open failed',
      }),
    )
    expect(isDatabaseOpen(dbName)).toBe(false)
  })
})
