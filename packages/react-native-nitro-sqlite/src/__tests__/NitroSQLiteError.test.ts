import NitroSQLiteError from '../NitroSQLiteError'

describe('NitroSQLiteError', () => {
  it('keeps its name, cause, and prototype', () => {
    const cause = new Error('underlying')
    const error = new NitroSQLiteError('query failed', { cause })

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(NitroSQLiteError)
    expect(error.name).toBe('NitroSQLiteError')
    expect(error.cause).toBe(cause)
    expect(error.type).toBeUndefined()
  })

  it('returns an existing NitroSQLiteError unchanged', () => {
    const error = new NitroSQLiteError('existing')
    expect(NitroSQLiteError.fromError(error)).toBe(error)
  })

  it('converts an Error while preserving its cause and stack', () => {
    const cause = new Error('root')
    const original = new Error('native failure', { cause })
    original.stack = 'original stack'

    const converted = NitroSQLiteError.fromError(original)

    expect(converted).toBeInstanceOf(NitroSQLiteError)
    expect(converted.message).toBe('native failure')
    expect(converted.cause).toBe(cause)
    expect(converted.stack).toBe('original stack')
  })

  it('converts an Error without a stack', () => {
    const original = new Error('no stack')
    original.stack = undefined
    expect(NitroSQLiteError.fromError(original).message).toBe('no stack')
  })

  it('converts strings and retains unknown values as causes', () => {
    expect(NitroSQLiteError.fromError('failure').message).toBe('failure')
    const value = { code: 42 }
    const converted = NitroSQLiteError.fromError(value)
    expect(converted.message).toBe('Unknown error occurred')
    expect(converted.cause).toBe(value)
  })

  it.each([
    'UnknownError',
    'DatabaseCannotBeOpened',
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

    const converted = NitroSQLiteError.fromError(original)

    expect(converted.type).toBe(type)
    expect(converted.message).toBe(original.message)
    expect(converted.stack).toBe(original.stack)
  })

  it('does not assign a native category for unrecognized exception types', () => {
    const error = NitroSQLiteError.fromError(
      '[NativeNitroSQLiteException][FutureError] failed',
    )

    expect(error.type).toBeUndefined()
    expect(error.message).toBe(
      '[NativeNitroSQLiteException][FutureError] failed',
    )
  })

  it('ignores an incomplete native exception category', () => {
    const error = NitroSQLiteError.fromError(
      '[NativeNitroSQLiteException][SqlExecutionError',
    )

    expect(error.type).toBeUndefined()
    expect(error.message).toBe(
      '[NativeNitroSQLiteException][SqlExecutionError',
    )
  })
})
