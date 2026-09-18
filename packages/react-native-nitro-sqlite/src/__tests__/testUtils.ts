import type { NitroSQLiteQueryResult } from '../specs/NitroSQLiteQueryResult.nitro'
import type { SQLiteValue } from '../types'

export function nativeResult(
  results: Record<string, SQLiteValue>[] = [],
): NitroSQLiteQueryResult {
  return { rowsAffected: results.length, results } as NitroSQLiteQueryResult
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
