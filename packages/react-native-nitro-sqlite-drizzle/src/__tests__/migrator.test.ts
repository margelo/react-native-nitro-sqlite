import { open, resetAllDatabases } from 'react-native-nitro-sqlite/mock'
import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import { drizzle, migrate } from '../index'

const migrations = {
  journal: {
    entries: [
      { idx: 0, when: 1, tag: '0000_users', breakpoints: true },
      { idx: 1, when: 2, tag: '0001_pets', breakpoints: true },
    ],
  },
  migrations: {
    m0000:
      'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);\n--> statement-breakpoint\nCREATE INDEX users_name ON users (name);',
    m0001: 'CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT NOT NULL);',
  },
}

afterEach(resetAllDatabases)

describe('migrate', () => {
  it('applies each migration once', async () => {
    const connection = open({ name: 'migrate' }) as NitroSQLiteConnection
    const db = drizzle(connection)

    await migrate(db, migrations)
    await migrate(db, migrations)

    const { results } = connection.execute(
      "SELECT name FROM sqlite_master WHERE name IN ('users', 'users_name', 'pets') ORDER BY name",
    )
    expect(results).toEqual([
      { name: 'pets' },
      { name: 'users' },
      { name: 'users_name' },
    ])
    expect(
      connection.execute('SELECT created_at FROM __drizzle_migrations').results,
    ).toEqual([{ created_at: 1 }, { created_at: 2 }])
  })

  it('rejects when a journal entry has no migration', async () => {
    const db = drizzle(open({ name: 'migrate' }) as NitroSQLiteConnection)

    await expect(
      migrate(db, {
        ...migrations,
        migrations: { m0001: migrations.migrations.m0001 },
      }),
    ).rejects.toThrow('Missing migration: 0000_users')
  })
})
