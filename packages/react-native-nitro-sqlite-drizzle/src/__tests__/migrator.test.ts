import { eq } from 'drizzle-orm'
import { open, resetAllDatabases } from 'react-native-nitro-sqlite/mock'
import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import { drizzle, migrate } from '../index'
import migrations from './fixtures/drizzle/migrations'
import { pets, users } from './fixtures/schema'

afterEach(resetAllDatabases)

describe('migrate', () => {
  it('applies each drizzle-kit migration once', async () => {
    const connection = open({ name: 'migrate' }) as NitroSQLiteConnection
    const db = drizzle(connection)

    await migrate(db, migrations)
    await migrate(db, migrations)

    expect(
      connection.execute('SELECT created_at FROM __drizzle_migrations').results,
    ).toEqual(
      migrations.journal.entries.map((entry) => ({ created_at: entry.when })),
    )
    expect(
      connection.execute(
        "SELECT name FROM sqlite_master WHERE name = 'pets_owner_id'",
      ).results,
    ).toEqual([{ name: 'pets_owner_id' }])

    await db.insert(users).values({ id: 1, name: 'Dave' })
    await db.insert(pets).values({ id: 7, name: 'Rex', ownerId: 1 })
    expect(
      await db
        .select({ owner: users.name, pet: pets.name })
        .from(pets)
        .innerJoin(users, eq(pets.ownerId, users.id)),
    ).toEqual([{ owner: 'Dave', pet: 'Rex' }])
  })

  it('rejects when a journal entry has no migration', async () => {
    const db = drizzle(open({ name: 'migrate' }) as NitroSQLiteConnection)

    await expect(
      migrate(db, { ...migrations, migrations: {} }),
    ).rejects.toThrow('Missing migration: 0000_init')
  })
})
