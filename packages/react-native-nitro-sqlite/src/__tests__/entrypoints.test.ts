jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    getHybridClass: jest.fn((name: string) =>
      name === 'rnnitrosqlite.PlatformContext'
        ? {
            databaseDirectory: '/data/databases',
            temporaryDirectory: '/data/cache',
            legacyDatabaseDirectory: undefined,
          }
        : class {
            open = jest.fn()
            constructorArguments: unknown[]
            constructor(...args: unknown[]) {
              this.constructorArguments = args
            }
          },
    ),
  },
}))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NitroModules } from 'react-native-nitro-modules'
import { NitroSQLite, SQLiteError, SQLiteExceptionType, open } from '../index'
import {
  SQLiteError as ErrorFromErrors,
  SQLiteExceptionType as ExceptionTypeFromErrors,
} from '../errors'
import { HybridNitroSQLite } from '../nitro'

describe('entrypoints', () => {
  it('shares the error class and category constants with the errors entry point', () => {
    expect(SQLiteError).toBe(ErrorFromErrors)
    expect(SQLiteExceptionType).toBe(ExceptionTypeFromErrors)
  })

  it('creates the native object and exposes its native and managed methods', () => {
    expect(NitroModules.getHybridClass).toHaveBeenCalledWith(
      'rnnitrosqlite.NitroSQLite',
    )
    expect(NitroSQLite.native).toBe(HybridNitroSQLite)
    expect(NitroSQLite.open).toBe(open)
    expect(NitroSQLite.open).not.toBe(HybridNitroSQLite.open)
  })

  it('stores databases in the platform directories', () => {
    expect(NitroModules.getHybridClass).toHaveBeenCalledWith(
      'rnnitrosqlite.PlatformContext',
    )
    expect(
      (HybridNitroSQLite as unknown as { constructorArguments: unknown[] })
        .constructorArguments,
    ).toEqual(['/data/databases', '/data/cache', undefined])
  })

  it('publishes built entry points so apps never compile the decorated specs', () => {
    const manifest = JSON.parse(
      readFileSync(join(__dirname, '../../package.json'), 'utf8'),
    ) as Record<string, unknown>
    const entryPoints = JSON.stringify([
      manifest.main,
      manifest.module,
      manifest['react-native'],
      manifest.source,
      manifest.exports,
    ])

    expect(entryPoints).not.toContain('src/')
  })
})
