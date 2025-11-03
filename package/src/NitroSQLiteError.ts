const NITRO_SQLITE_ERROR_NAME = 'NitroSQLiteError'

/**
 * Custom error class for NitroSQLite operations
 * Extends the native Error class with proper prototype chain and error handling
 */
export default class NitroSQLiteError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = NITRO_SQLITE_ERROR_NAME

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

  /**
   * Converts a native error (from C++ bridge) to a NitroSQLiteError
   * Alias for fromError for semantic clarity
   */
  static fromNativeError(error: unknown): NitroSQLiteError {
    return NitroSQLiteError.fromError(error)
  }
}
