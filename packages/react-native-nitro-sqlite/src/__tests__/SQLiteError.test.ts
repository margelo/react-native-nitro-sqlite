jest.mock('react-native-nitro-modules', () => {
  throw new Error('The errors entry point must not load the native runtime')
})

import {
  SQLiteError,
  SQLiteExceptionType,
  NitroSQLiteError,
  NitroSQLiteExceptionType,
} from '../errors'

describe('SQLiteError', () => {
  it('preserves the legacy error constructor and category exports', () => {
    expect(NitroSQLiteError).toBe(SQLiteError)
    expect(NitroSQLiteExceptionType).toBe(SQLiteExceptionType)
    expect(new SQLiteError('query failed')).toBeInstanceOf(NitroSQLiteError)
  })

  it('keeps its name, cause, and prototype', () => {
    const cause = new Error('underlying')
    const error = new SQLiteError('query failed', { cause })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(SQLiteError)
    expect(error.name).toBe('NitroSQLiteError')
    expect(error.cause).toBe(cause)
    expect(error.type).toBeUndefined()
  })

  it('supports comparing a native failure against the exported category', () => {
    const error = SQLiteError.fromError(
      '[NativeNitroSQLiteException][DatabaseCannotBeOpened] failed',
    )
    const category: SQLiteExceptionType =
      SQLiteExceptionType.DatabaseCannotBeOpened

    expect(error.type).toBe(category)
  })

  it('returns an existing SQLiteError unchanged', () => {
    const error = new SQLiteError('existing')
    expect(SQLiteError.fromError(error)).toBe(error)
  })

  it('converts an Error while preserving its cause and stack', () => {
    const cause = new Error('root')
    const original = new Error('native failure', { cause })
    original.stack = 'original stack'

    const converted = SQLiteError.fromError(original)

    expect(converted).toBeInstanceOf(SQLiteError)
    expect(converted.message).toBe('native failure')
    expect(converted.cause).toBe(cause)
    expect(converted.stack).toBe('original stack')
  })

  it('converts an Error without a stack', () => {
    const original = new Error('no stack')
    original.stack = undefined
    expect(SQLiteError.fromError(original).message).toBe('no stack')
  })

  it('converts strings and retains unknown values as causes', () => {
    expect(SQLiteError.fromError('failure').message).toBe('failure')
    const value = { code: 42 }
    const converted = SQLiteError.fromError(value)
    expect(converted.message).toBe('Unknown error occurred')
    expect(converted.cause).toBe(value)
  })

  it.each([
    'UnknownError',
    'DatabaseCannotBeOpened',
    'EncryptionNotEnabled',
    'DatabaseCannotBeDecrypted',
    'DatabaseNotOpen',
    'UnableToAttachToDatabase',
    'SqlExecutionError',
    'CouldNotLoadFile',
    'NoBatchCommandsProvided',
  ])('exposes the %s native exception category', (type) => {
    const original = new Error(
      `Exception in HostFunction: [NativeNitroSQLiteException][${type}] failed`,
    )
    original.stack = 'native stack'

    const converted = SQLiteError.fromError(original)

    expect(converted.type).toBe(type)
    expect(converted.message).toBe(original.message)
    expect(converted.stack).toBe(original.stack)
  })

  it('does not assign a native category for unrecognized exception types', () => {
    const error = SQLiteError.fromError(
      '[NativeNitroSQLiteException][FutureError] failed',
    )

    expect(error.type).toBeUndefined()
    expect(error.message).toBe(
      '[NativeNitroSQLiteException][FutureError] failed',
    )
  })

  it('ignores an incomplete native exception category', () => {
    const error = SQLiteError.fromError(
      '[NativeNitroSQLiteException][SqlExecutionError',
    )

    expect(error.type).toBeUndefined()
    expect(error.message).toBe('[NativeNitroSQLiteException][SqlExecutionError')
  })
})
