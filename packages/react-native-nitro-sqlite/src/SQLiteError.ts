const SQLITE_ERROR_NAME = 'NitroSQLiteError' as const
const NATIVE_EXCEPTION_PREFIX = '[NativeNitroSQLiteException]['

/**
 * Native error categories exposed by {@linkcode SQLiteError.type}.
 * Compare against these constants when handling a specific failure. The values
 * are categories, not SQLite's numeric result codes. Import them from
 * `react-native-nitro-sqlite/errors` to avoid initializing the native module.
 * @see {@linkcode SQLiteError}
 */
export const SQLiteExceptionType = {
  /** Native failure without a more specific category. */
  UnknownError: 'UnknownError',
  /** Open failure, including invalid paths and an already-open default connection. */
  DatabaseCannotBeOpened: 'DatabaseCannotBeOpened',
  /** An encryption key was supplied to a build without SQLite SEE. */
  EncryptionNotEnabled: 'EncryptionNotEnabled',
  /** Invalid encryption key, unreadable encrypted database, or existing plaintext file. */
  DatabaseCannotBeDecrypted: 'DatabaseCannotBeDecrypted',
  /** Category for a database connection that is not open. */
  DatabaseNotOpen: 'DatabaseNotOpen',
  /** Database attachment failure or an unopened native connection. */
  UnableToAttachToDatabase: 'UnableToAttachToDatabase',
  /** SQL execution or parameter binding failure, including a missing database file. */
  SqlExecutionError: 'SqlExecutionError',
  /** A SQL file could not be read or executed. */
  CouldNotLoadFile: 'CouldNotLoadFile',
  /** An empty batch was submitted. */
  NoBatchCommandsProvided: 'NoBatchCommandsProvided',
} as const

/**
 * Category attached to {@linkcode SQLiteError.type} for a recognized native
 * failure. The corresponding {@linkcode SQLiteExceptionType} object exposes
 * the same values at runtime.
 * @see {@linkcode SQLiteError.type}
 */
export type SQLiteExceptionType =
  (typeof SQLiteExceptionType)[keyof typeof SQLiteExceptionType]

/** Error thrown by managed NitroSQLite operations. Native errors are wrapped with this class. */
export default class SQLiteError extends Error {
  /**
   * Recognized native category from {@linkcode SQLiteExceptionType}, or
   * `undefined` for JavaScript failures and unrecognized native categories.
   */
  readonly type: SQLiteExceptionType | undefined

  /** Create an error with a message and optional cause. */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = SQLITE_ERROR_NAME
    this.type = getNativeExceptionType(message)

    // Maintains proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SQLiteError.prototype)
  }

  /** Convert an unknown thrown value to `SQLiteError`.
   * Existing instances pass through; `Error` values keep their stack and cause.
   * @param error Value to normalize.
   * @returns A SQLiteError instance.
   */
  static fromError(error: unknown): SQLiteError {
    if (error instanceof SQLiteError) {
      return error
    }

    if (error instanceof Error) {
      const sqliteError = new SQLiteError(error.message, {
        cause: error.cause,
      })

      // Preserve original stack trace if available
      if (error.stack) {
        sqliteError.stack = error.stack
      }
      return sqliteError
    }

    if (typeof error === 'string') {
      return new SQLiteError(error)
    }

    return new SQLiteError('Unknown error occurred', {
      cause: error,
    })
  }
}

function getNativeExceptionType(
  message: string,
): SQLiteExceptionType | undefined {
  const prefixStart = message.indexOf(NATIVE_EXCEPTION_PREFIX)
  if (prefixStart === -1) return undefined

  const typeStart = prefixStart + NATIVE_EXCEPTION_PREFIX.length
  const typeEnd = message.indexOf(']', typeStart)
  if (typeEnd === -1) return undefined

  const type = message.slice(typeStart, typeEnd)
  return Object.values(SQLiteExceptionType).find((value) => value === type)
}
