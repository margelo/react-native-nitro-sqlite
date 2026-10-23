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
import { deferred, nativeResult } from './testUtils'

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
      expect.any(Function),
    )
    expect(HybridNitroSQLite.executeAsync).toHaveBeenCalledTimes(3)
  })

  it('joins rows delivered in batches before the remaining result rows', async () => {
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockImplementationOnce(async (_dbName, _query, _params, onRows) => {
        onRows?.([{ value: 1 }, { value: 2 }])
        onRows?.([{ value: 3 }])
        return nativeResult([{ value: 4 }])
      })

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

  it.each([
    { size: 256, earlyBatches: 0, pendingNative: false },
    { size: 257, earlyBatches: 0, pendingNative: true },
    { size: 512, earlyBatches: 0, pendingNative: false },
    { size: 1_000, earlyBatches: 0, pendingNative: false },
    { size: 1_000, earlyBatches: 1, pendingNative: false },
    { size: 1_000, earlyBatches: 3, pendingNative: false },
  ])(
    'waits for all batches with $size rows, $earlyBatches early batches, and pendingNative=$pendingNative',
    async ({ size, earlyBatches, pendingNative }) => {
      const rows = Array.from({ length: size }, (_, value) => ({ value }))
      const rowBatchCount = Math.floor(size / 256)
      const native = {
        ...nativeResult(rows.slice(rowBatchCount * 256)),
        rowBatchCount,
      }
      const completion = deferred<typeof native>()
      const deliveries: (() => void)[] = []
      jest
        .mocked(HybridNitroSQLite.executeAsync)
        .mockImplementationOnce((_dbName, _query, _params, onRows) => {
          for (let batch = 0; batch < rowBatchCount; batch++) {
            deliveries.push(() =>
              onRows?.(rows.slice(batch * 256, (batch + 1) * 256)),
            )
          }
          deliveries.splice(0, earlyBatches).forEach((deliver) => deliver())
          return pendingNative ? completion.promise : Promise.resolve(native)
        })

      const completed = jest.fn()
      const pending = executeAsync<{ value: number }>(
        dbName,
        query,
        params,
      ).then((result) => {
        completed()
        return result
      })
      completion.resolve(native)
      await new Promise<void>((resolve) => setImmediate(resolve))
      expect(completed).toHaveBeenCalledTimes(deliveries.length === 0 ? 1 : 0)

      while (deliveries.length > 0) {
        deliveries.shift()?.()
        if (deliveries.length > 0) {
          await new Promise<void>((resolve) => setImmediate(resolve))
          expect(completed).not.toHaveBeenCalled()
        }
      }

      const result = await pending
      expect(result.results).toEqual(rows)
      expect(result.rows._array).toBe(result.results)
      expect(result.rows.length).toBe(size)
      expect(result.rows.item(size - 1)).toEqual(rows[size - 1])
    },
  )

  it('keeps the native rows when no batch was delivered', async () => {
    const native = nativeResult([{ value: 7 }])
    jest.mocked(HybridNitroSQLite.executeAsync).mockResolvedValueOnce(native)

    const result = await executeAsync(dbName, query, params)
    expect(result.results).toBe(native.results)
    expect(result.rows._array).toBe(native.results)
  })

  it('keeps a managed connection busy until row delivery completes', async () => {
    openDatabaseQueue(dbName)
    const delivery = deferred<() => void>()
    jest
      .mocked(HybridNitroSQLite.executeAsync)
      .mockImplementationOnce(async (_dbName, _query, _params, onRows) => {
        delivery.resolve(() => onRows?.([{ value: 1 }]))
        return { ...nativeResult([{ value: 2 }]), rowBatchCount: 1 }
      })

    const pending = executeAsync(dbName, query)
    const deliver = await delivery.promise
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(() => execute(dbName, query)).toThrow('busy')

    deliver()
    await expect(pending).resolves.toMatchObject({ rows: { length: 2 } })
    expect(() => closeDatabaseQueue(dbName)).not.toThrow()
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
