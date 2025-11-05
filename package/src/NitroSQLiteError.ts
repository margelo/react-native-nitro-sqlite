const NATIVE_NITRO_SQLITE_EXCEPTION_PREFIX = '[NitroSQLiteException] ' as const
const NITRO_SQLITE_ERROR_NAME = 'NitroSQLiteError' as const
const getNitroSQLiteErrorPrefix = (isNativeNitroSQLiteException: boolean) =>
  isNativeNitroSQLiteException ? '[NitroSQLite (Native/C++)]' : '[NitroSQLite] '

type NitroSQLiteErrorOptions = ErrorOptions & {
  isNativeNitroSQLiteException?: boolean
}

/**
 * Custom error class for NitroSQLite operations
 * Extends the native Error class with proper prototype chain and error handling
 */
export default class NitroSQLiteError extends Error {
  constructor(message: string, options?: NitroSQLiteErrorOptions) {
    const { isNativeNitroSQLiteException = false, ...restOptions } =
      options ?? {}

    super(message, restOptions)
    this.name = NITRO_SQLITE_ERROR_NAME
    this.message =
      getNitroSQLiteErrorPrefix(isNativeNitroSQLiteException) + message

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, NitroSQLiteError.prototype)
  }

  /**
   * Converts an unknown error to a NitroSQLiteError
   * Preserves stack traces and error causes when available
   */
  static fromError(error: unknown): NitroSQLiteError {
    if (error instanceof NitroSQLiteError) {
      return error
    }

    if (error instanceof Error) {
      if (error.message.includes(NATIVE_NITRO_SQLITE_EXCEPTION_PREFIX)) {
        return new NitroSQLiteError(error.message, {
          cause: error.cause,
          isNativeNitroSQLiteException: true,
        })
      }

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
      return new NitroSQLiteError(error, {
        isNativeNitroSQLiteException: error.includes(
          NATIVE_NITRO_SQLITE_EXCEPTION_PREFIX,
        ),
      })
    }

    return new NitroSQLiteError('Unknown error occurred', {
      cause: error,
    })
  }
}
