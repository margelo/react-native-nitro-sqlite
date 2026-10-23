import { createElement, StrictMode } from 'react'
import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { open, resetAllDatabases } from 'react-native-nitro-sqlite/mock'
import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import { drizzle, useMigrations } from '../index'
import type { MigrationState, NitroSQLiteDatabase } from '../index'
import migrations from './fixtures/drizzle/migrations'

let renderer: ReactTestRenderer | undefined

afterEach(async () => {
  await act(async () => renderer?.unmount())
  renderer = undefined
  jest.restoreAllMocks()
  resetAllDatabases()
})

it('finishes migrations after a Strict Mode effect replay', async () => {
  const connection = open({ name: 'strict-migrate' }) as NitroSQLiteConnection
  const db = drizzle(connection)
  let state: MigrationState | undefined
  function Migrations() {
    state = useMigrations(db, migrations)
    return null
  }

  await act(async () => {
    renderer = create(
      createElement(StrictMode, null, createElement(Migrations)),
    )
  })

  expect(state).toEqual({ success: true })
  expect(
    connection.execute('SELECT created_at FROM __drizzle_migrations').results,
  ).toHaveLength(1)
})

it('ignores an earlier database result while the current migration is pending', async () => {
  const firstDb = drizzle(
    open({ name: 'first-migrate' }) as NitroSQLiteConnection,
  )
  const nextDb = drizzle(
    open({ name: 'next-migrate' }) as NitroSQLiteConnection,
  )
  const first = Promise.withResolvers<void>()
  const next = Promise.withResolvers<void>()
  jest.spyOn(firstDb.dialect, 'migrate').mockReturnValue(first.promise)
  jest.spyOn(nextDb.dialect, 'migrate').mockReturnValue(next.promise)
  let state: MigrationState | undefined
  function Migrations({ db }: { db: NitroSQLiteDatabase }) {
    state = useMigrations(db, migrations)
    return null
  }

  await act(async () => {
    renderer = create(createElement(Migrations, { db: firstDb }))
  })
  await act(async () => {
    renderer?.update(createElement(Migrations, { db: nextDb }))
  })
  await act(async () => first.resolve())

  expect(state).toEqual({ success: false })

  await act(async () => next.resolve())
  expect(state).toEqual({ success: true })
})

it('reports a migration failure', async () => {
  const db = drizzle(open({ name: 'failed-migrate' }) as NitroSQLiteConnection)
  const missing = { ...migrations, migrations: {} }
  let state: MigrationState | undefined
  function Migrations() {
    state = useMigrations(db, missing)
    return null
  }

  await act(async () => {
    renderer = create(createElement(Migrations))
  })

  expect(state?.success).toBe(false)
  expect(state?.error?.message).toBe('Missing migration: 0000_init')
})
