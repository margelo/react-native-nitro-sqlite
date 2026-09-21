jest.mock('../nitro')

import { HybridNitroSQLite } from '../nitro'
import { closeDatabaseQueue, openDatabaseQueue } from '../DatabaseQueue'
import NitroSQLiteError from '../NitroSQLiteError'
import {
  buildJSQueryResult,
  execute,
  executeAsync,
  executeAsyncManaged,
  executeManaged,
} from '../operations/execute'
import { nativeResult } from './testUtils'

const dbName = 'execute-test'
const query = 'SELECT ? AS value'
const params = [7]

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

describe('execute', () => {
  it('passes unmanaged synchronous queries to native and builds row access', () => {
    const rows = [{ value: 7 }, { value: null }]
    const native = nativeResult(rows)
    jest.mocked(HybridNitroSQLite.execute).mockReturnValue(native)

    const result = execute(dbName, query, params)

    expect(HybridNitroSQLite.execute).toHaveBeenCalledWith(
      dbName,
      query,
      params,
    )
    expect(result).toBe(native)
    expect(result.rows._array).toBe(rows)
    expect(result.rows.length).toBe(2)
    expect(result.rows.item(0)).toBe(rows[0])
    expect(result.rows.item(2)).toBeUndefined()
  })

  it('reads native results only once and supports empty results', () => {
    const native = nativeResult()
    const read = jest.fn(() => [])
    Object.defineProperty(native, 'results', { get: read })

    const result = buildJSQueryResult(native)

    expect(read).toHaveBeenCalledTimes(1)
    expect(result.rows).toEqual({
      _array: [],
      length: 0,
      item: expect.any(Function),
    })
    expect(result.rows.item(0)).toBeUndefined()
  })

  it('routes managed synchronous queries through the queue', () => {
    openDatabaseQueue(dbName)
    jest.mocked(HybridNitroSQLite.execute).mockReturnValue(nativeResult())

    expect(executeManaged(dbName, query).rows.length).toBe(0)
    expect(execute(dbName, query).rows.length).toBe(0)
    expect(HybridNitroSQLite.execute).toHaveBeenCalledTimes(2)
  })

  it('converts native synchronous errors', () => {
    jest.mocked(HybridNitroSQLite.execute).mockImplementation(() => {
      throw new Error('SQL failed')
    })

    expect(() => execute(dbName, query)).toThrow(NitroSQLiteError)
    expect(() => execute(dbName, query)).toThrow('SQL failed')
  })

  it('runs unmanaged and managed asynchronous queries', async () => {
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockResolvedValue(nativeResult([{ value: 7 }]))

    expect((await executeAsync(dbName, query, params)).rows.item(0)).toEqual({
      value: 7,
    })
    openDatabaseQueue(dbName)
    expect((await executeAsyncManaged(dbName, query)).rows.length).toBe(1)
    expect((await executeAsync(dbName, query)).rows.length).toBe(1)
    expect(HybridNitroSQLite.executeAsync).toHaveBeenNthCalledWith(
      1,
      dbName,
      query,
      params,
    )
    expect(HybridNitroSQLite.executeAsync).toHaveBeenCalledTimes(3)
  })

  it('converts native asynchronous errors and releases a managed queue', async () => {
    openDatabaseQueue(dbName)
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockRejectedValueOnce('async failed')
      .mockResolvedValueOnce(nativeResult())

    await expect(executeAsync(dbName, query)).rejects.toMatchObject({
      name: 'NitroSQLiteError',
      message: 'async failed',
    })
    await expect(executeAsync(dbName, query)).resolves.toMatchObject({
      rows: { length: 0 },
    })
  })
})
