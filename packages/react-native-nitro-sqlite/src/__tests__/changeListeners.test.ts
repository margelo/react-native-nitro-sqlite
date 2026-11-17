jest.mock('../nitro')

import { HybridNitroSQLite } from '../nitro'
import { closeDatabaseQueue, isDatabaseOpen } from '../DatabaseQueue'
import { open } from '../operations/session'
import type { DatabaseChange } from '../types'

const dbName = 'change-listener-test'
const insert: DatabaseChange = {
  operation: 'insert',
  database: 'main',
  table: 'users',
  rowId: 1,
}

// Returns the handler most recently passed to native code.
function nativeHandler() {
  const { calls } = jest.mocked(HybridNitroSQLite.setChangeHandler).mock
  const handler = calls[calls.length - 1]?.[1]
  if (!handler) throw new Error('No native change handler is set')
  return handler
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(HybridNitroSQLite.isConnectionOpen).mockReturnValue(true)
})

afterEach(() => {
  jest.useRealTimers()
  if (isDatabaseOpen(dbName)) closeDatabaseQueue(dbName)
})

describe('addChangeListener', () => {
  it('sets the native handler for the first listener and clears it after the last', () => {
    const db = open({ name: dbName })
    const first = jest.fn()
    const second = jest.fn()

    const firstSubscription = db.addChangeListener(first)
    const secondSubscription = db.addChangeListener(second)
    expect(HybridNitroSQLite.setChangeHandler).toHaveBeenCalledTimes(1)
    expect(HybridNitroSQLite.setChangeHandler).toHaveBeenCalledWith(
      dbName,
      expect.any(Function),
    )

    nativeHandler()([insert])
    expect(first).toHaveBeenCalledWith([insert])
    expect(second).toHaveBeenCalledWith([insert])

    firstSubscription.remove()
    expect(HybridNitroSQLite.setChangeHandler).toHaveBeenCalledTimes(1)
    secondSubscription.remove()
    secondSubscription.remove()
    expect(HybridNitroSQLite.setChangeHandler).toHaveBeenCalledTimes(2)
    expect(HybridNitroSQLite.setChangeHandler).toHaveBeenLastCalledWith(dbName)
    db.close()
  })

  it('treats each registration of the same function as its own subscription', () => {
    const db = open({ name: dbName })
    const listener = jest.fn()
    const subscription = db.addChangeListener(listener)
    db.addChangeListener(listener)

    nativeHandler()([insert])
    expect(listener).toHaveBeenCalledTimes(2)

    subscription.remove()
    nativeHandler()([insert])
    expect(listener).toHaveBeenCalledTimes(3)
    db.close()
  })

  it('keeps calling other listeners and reports a listener error later', () => {
    jest.useFakeTimers()
    const db = open({ name: dbName })
    const error = new Error('listener failed')
    const after = jest.fn()
    db.addChangeListener(() => {
      throw error
    })
    db.addChangeListener(after)

    nativeHandler()([insert])
    expect(after).toHaveBeenCalledWith([insert])
    expect(() => jest.runOnlyPendingTimers()).toThrow(error)
    db.close()
  })

  it('does not touch native code when removing a listener after close', () => {
    const db = open({ name: dbName })
    const subscription = db.addChangeListener(jest.fn())
    db.close()

    subscription.remove()
    expect(HybridNitroSQLite.setChangeHandler).toHaveBeenCalledTimes(1)
  })

  it('drops listeners when the database is deleted', () => {
    const db = open({ name: dbName })
    const subscription = db.addChangeListener(jest.fn())
    db.delete()

    subscription.remove()
    expect(HybridNitroSQLite.setChangeHandler).toHaveBeenCalledTimes(1)
  })

  it('drops listeners when a failed delete already closed the native connection', () => {
    const db = open({ name: dbName })
    const subscription = db.addChangeListener(jest.fn())
    jest.mocked(HybridNitroSQLite.drop).mockImplementationOnce(() => {
      throw new Error('unlink failed')
    })
    jest.mocked(HybridNitroSQLite.isConnectionOpen).mockReturnValue(false)

    expect(() => db.delete()).toThrow('unlink failed')
    subscription.remove()
    expect(HybridNitroSQLite.setChangeHandler).toHaveBeenCalledTimes(1)
  })

  it('rejects a listener on a closed connection', () => {
    const db = open({ name: dbName })
    db.close()
    expect(() => db.addChangeListener(jest.fn())).toThrow(/not open/)
    expect(HybridNitroSQLite.setChangeHandler).not.toHaveBeenCalled()
  })
})
