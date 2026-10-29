import type { NativeQueryResult } from '../specs/NativeQueryResult'
import type { SQLiteValue } from '../types'

export function nativeResult(
  results: Record<string, SQLiteValue>[] = [],
): NativeQueryResult {
  return { rowsAffected: results.length, results } as NativeQueryResult
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
