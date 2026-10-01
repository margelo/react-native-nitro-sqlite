jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn((name: string) =>
      name === 'NitroSQLiteOnLoad' ? { init: jest.fn() } : { open: jest.fn() },
    ),
  },
}))

import { NitroModules } from 'react-native-nitro-modules'
import { NitroSQLite, open } from '../index'
import { HybridNitroSQLite } from '../nitro'
import { init as androidInit } from '../OnLoad.android'
import { init as iosInit } from '../OnLoad'

describe('entrypoints', () => {
  it('creates the native object and exposes its native and managed methods', () => {
    expect(NitroModules.createHybridObject).toHaveBeenCalledWith('NitroSQLite')
    expect(NitroSQLite.native).toBe(HybridNitroSQLite)
    expect(NitroSQLite.open).toBe(open)
    expect(NitroSQLite.open).not.toBe(HybridNitroSQLite.open)
    expect(iosInit()).toBeUndefined()
  })

  it('initializes the Android native loader', () => {
    androidInit()

    expect(NitroModules.createHybridObject).toHaveBeenCalledWith(
      'NitroSQLiteOnLoad',
    )
    const onLoad = jest
      .mocked(NitroModules.createHybridObject)
      .mock.results.find((result) => 'init' in result.value)?.value
    expect(onLoad?.init).toHaveBeenCalledTimes(1)
  })
})
