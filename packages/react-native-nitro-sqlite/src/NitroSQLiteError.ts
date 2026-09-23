const NITRO_SQLITE_ERROR_NAME = 'NitroSQLiteError' as const

/** Error thrown by managed NitroSQLite operations. Native errors are wrapped with this class. */
export default class NitroSQLiteError extends Error {
  /** Create an error with a message and optional cause. */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = NITRO_SQLITE_ERROR_NAME

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
