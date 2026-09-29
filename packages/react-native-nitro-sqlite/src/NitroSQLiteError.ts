const NITRO_SQLITE_ERROR_NAME = 'NitroSQLiteError' as const
const NATIVE_EXCEPTION_PREFIX = '[NativeNitroSQLiteException]['

/** Category attached to an error thrown by NitroSQLite's native implementation. */
export type NitroSQLiteExceptionType =
  | 'UnknownError'
  | 'DatabaseCannotBeOpened'
  | 'DatabaseNotOpen'
  | 'UnableToAttachToDatabase'
  | 'SqlExecutionError'
  | 'CouldNotLoadFile'
  | 'NoBatchCommandsProvided'

/** Error thrown by managed NitroSQLite operations. Native errors are wrapped with this class. */
export default class NitroSQLiteError extends Error {
  /** Native exception category, if this error originated in NitroSQLite's C++ code. */
  readonly type: NitroSQLiteExceptionType | undefined

  /** Create an error with a message and optional cause. */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = NITRO_SQLITE_ERROR_NAME
    this.type = getNativeExceptionType(message)

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, NitroSQLiteError.prototype)
  }

  /** Convert an unknown thrown value to `NitroSQLiteError`.
   * Existing instances pass through; `Error` values keep their stack and cause.
   * @param error Value to normalize.
   * @returns A NitroSQLiteError instance.
   */
  static fromError(error: unknown): NitroSQLiteError {
    if (error instanceof NitroSQLiteError) {
      return error
    }

    if (error instanceof Error) {
      const nitroSQLiteError = new NitroSQLiteError(error.message, {
        cause: error.cause,
      })

      // Preserve original stack trace if available
      if (error.stack) {
        nitroSQLiteError.stack = error.stack
      }
      return nitroSQLiteError
    }

    if (typeof error === 'string') {
      return new NitroSQLiteError(error)
    }

    return new NitroSQLiteError('Unknown error occurred', {
      cause: error,
    })
  }
}

function getNativeExceptionType(
  message: string,
): NitroSQLiteExceptionType | undefined {
  const prefixStart = message.indexOf(NATIVE_EXCEPTION_PREFIX)
  if (prefixStart === -1) return undefined

  const typeStart = prefixStart + NATIVE_EXCEPTION_PREFIX.length
  const typeEnd = message.indexOf(']', typeStart)
  if (typeEnd === -1) return undefined

  const type = message.slice(typeStart, typeEnd)
  switch (type) {
    case 'UnknownError':
    case 'DatabaseCannotBeOpened':
    case 'DatabaseNotOpen':
    case 'UnableToAttachToDatabase':
    case 'SqlExecutionError':
    case 'CouldNotLoadFile':
    case 'NoBatchCommandsProvided':
      return type
    default:
      return undefined
  }
}
