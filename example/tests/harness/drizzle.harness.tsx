import '@/initGlobals'
import React from 'react'
import { describe, expect, it, render, waitUntil } from 'react-native-harness'
import { open } from 'react-native-nitro-sqlite'
import { drizzle, useMigrations } from 'react-native-nitro-sqlite-drizzle'
import migrations from 'react-native-nitro-sqlite-drizzle/src/__tests__/fixtures/drizzle/migrations'
import { registerDrizzleUnitTests } from '@tests/unit'
import init from './init'

init()
registerDrizzleUnitTests()

describe('useMigrations', () => {
  it('reports success once the migrations ran', async () => {
    const connection = open({ name: 'test_drizzle_hook' })
    const db = drizzle(connection)
    let state: ReturnType<typeof useMigrations> | undefined
    function Migrations() {
      state = useMigrations(db, migrations)
      return null
    }

    await render(<Migrations />)
    await waitUntil(() => state?.success)

    expect(
      connection.execute("SELECT name FROM sqlite_master WHERE name = 'users'")
        .results,
    ).toEqual([{ name: 'users' }])
    connection.close()
    connection.delete()
  })
})
