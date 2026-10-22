jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    getHybridClass: jest.fn((name: string) =>
      name === 'rnnitrosqlite.NitroSQLiteOnLoad'
        ? { init: jest.fn() }
        : class {
            open = jest.fn()
          },
    ),
  },
}))

import { NitroModules } from 'react-native-nitro-modules'
import {
  NitroSQLite,
  NitroSQLiteError,
  NitroSQLiteExceptionType,
  open,
} from '../index'
import {
  NitroSQLiteError as ErrorFromErrors,
  NitroSQLiteExceptionType as ExceptionTypeFromErrors,
} from '../errors'
import { HybridNitroSQLite } from '../nitro'
import { init as androidInit } from '../OnLoad.android'
import { init as iosInit } from '../OnLoad'

describe('entrypoints', () => {
  it('shares the error class and category constants with the errors entry point', () => {
    expect(NitroSQLiteError).toBe(ErrorFromErrors)
    expect(NitroSQLiteExceptionType).toBe(ExceptionTypeFromErrors)
  })

  it('creates the native object and exposes its native and managed methods', () => {
    expect(NitroModules.getHybridClass).toHaveBeenCalledWith(
      'rnnitrosqlite.NitroSQLite',
    )
    expect(NitroSQLite.native).toBe(HybridNitroSQLite)
    expect(NitroSQLite.open).toBe(open)
    expect(NitroSQLite.open).not.toBe(HybridNitroSQLite.open)
    expect(iosInit()).toBeUndefined()
  })

  it('initializes the Android native loader', () => {
    androidInit()

    expect(NitroModules.getHybridClass).toHaveBeenCalledWith(
      'rnnitrosqlite.NitroSQLiteOnLoad',
    )
    const onLoad = jest
      .mocked(NitroModules.getHybridClass)
      .mock.results.map((result) => result.value as { init?: jest.Mock })
      .find((value) => 'init' in value)
    expect(onLoad?.init).toHaveBeenCalledTimes(1)
  })
})
