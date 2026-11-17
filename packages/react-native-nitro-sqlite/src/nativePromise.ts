import NitroSQLiteError from './NitroSQLiteError'

/** Calls an async native method without an `async` wrapper and its extra promise.
 * Reports a synchronous throw or a rejection as a rejected NitroSQLiteError.
 */
export function callNativeAsync<Result>(
  call: () => Promise<Result>,
): Promise<Result> {
  let nativeResult: Promise<Result>
  try {
    nativeResult = call()
  } catch (error) {
    return Promise.reject(NitroSQLiteError.fromError(error))
  }
  return nativeResult.catch(rejectWithNitroSQLiteError)
}

/** Rethrows any error as a NitroSQLiteError, for use as a promise rejection handler. */
export function rejectWithNitroSQLiteError(error: unknown): never {
  throw NitroSQLiteError.fromError(error)
}
