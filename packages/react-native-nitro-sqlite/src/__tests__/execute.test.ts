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

// The managed API registers its row batch handler on the first async query.
let deliverRowBatch:
  | Parameters<typeof HybridNitroSQLite.setRowBatchHandler>[0]
  | undefined
jest
  .mocked(HybridNitroSQLite.setRowBatchHandler)
  .mockImplementation((handler) => {
    deliverRowBatch = handler
  })

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
      undefined,
      expect.any(Number),
    )
    expect(HybridNitroSQLite.executeAsync).toHaveBeenCalledTimes(3)
  })

  it('joins rows delivered in batches before the remaining result rows', async () => {
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockImplementationOnce(
        async (_dbName, _query, _params, _onRows, rowBatchId) => {
          deliverRowBatch!(rowBatchId!, [{ value: 1 }, { value: 2 }])
          deliverRowBatch!(rowBatchId!, [{ value: 3 }])
          return { ...nativeResult([{ value: 4 }]), batchedRowCount: 3 }
        },
      )

    const result = await executeAsync(dbName, query, params)
    expect(result.results).toEqual([
      { value: 1 },
      { value: 2 },
      { value: 3 },
      { value: 4 },
    ])
    expect(result.rows._array).toBe(result.results)
    expect(result.rows.length).toBe(4)
    expect(result.rows.item(3)).toEqual({ value: 4 })
  })

  it('waits for row batches that arrive after the native result', async () => {
    let rowBatchId: number | undefined
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockImplementationOnce((_dbName, _query, _params, _onRows, id) => {
        rowBatchId = id
        return Promise.resolve({
          ...nativeResult([{ value: 3 }]),
          batchedRowCount: 2,
        })
      })

    let settled = false
    const pending = executeAsync(dbName, query, params).then((result) => {
      settled = true
      return result
    })
    await Promise.resolve()
    await Promise.resolve()
    deliverRowBatch!(rowBatchId!, [{ value: 1 }])
    await Promise.resolve()
    expect(settled).toBe(false)

    deliverRowBatch!(rowBatchId!, [{ value: 2 }])
    const result = await pending
    expect(result.results).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }])
    expect(result.rows.length).toBe(3)
  })

  it('passes a row callback to native builds without setRowBatchHandler', async () => {
    let olderNative = HybridNitroSQLite
    let olderExecuteAsync = executeAsync
    jest.isolateModules(() => {
      olderNative =
        jest.requireMock<typeof import('../nitro')>(
          '../nitro',
        ).HybridNitroSQLite
      delete (olderNative as Partial<typeof olderNative>).setRowBatchHandler
      olderExecuteAsync = jest.requireActual<
        typeof import('../operations/execute')
      >('../operations/execute').executeAsync
    })
    jest
      .mocked(olderNative.executeAsync)
      .mockImplementationOnce(async (_dbName, _query, _params, onRows) => {
        onRows?.([{ value: 1 }])
        return nativeResult([{ value: 2 }])
      })

    const result = await olderExecuteAsync(dbName, query)
    expect(result.results).toEqual([{ value: 1 }, { value: 2 }])
    expect(olderNative.executeAsync).toHaveBeenCalledWith(
      dbName,
      query,
      undefined,
      expect.any(Function),
    )
  })

  it('keeps the native rows when no batch was delivered', async () => {
    const native = nativeResult([{ value: 7 }])
    jest.mocked(HybridNitroSQLite.executeAsync).mockResolvedValueOnce(native)

    const result = await executeAsync(dbName, query, params)
    expect(result.results).toBe(native.results)
    expect(result.rows._array).toBe(native.results)
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

  it('rejects instead of throwing when the native call throws synchronously', async () => {
    openDatabaseQueue(dbName)
    jest.mocked(HybridNitroSQLite.executeAsync).mockImplementationOnce(() => {
      throw new Error('bind failed')
    })

    let pending: Promise<unknown> | undefined
    expect(() => {
      pending = executeAsync(dbName, query)
    }).not.toThrow()
    await expect(pending).rejects.toMatchObject({
      name: 'NitroSQLiteError',
      message: 'bind failed',
    })
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockResolvedValueOnce(nativeResult())
    await expect(executeAsync(dbName, query)).resolves.toMatchObject({
      rows: { length: 0 },
    })
  })

  it('rejects instead of throwing when a managed queue is not open', async () => {
    let pending: Promise<unknown> | undefined
    expect(() => {
      pending = executeAsyncManaged(dbName, query, undefined, 'missing-queue')
    }).not.toThrow()
    await expect(pending).rejects.toThrow('not open')
  })
})
