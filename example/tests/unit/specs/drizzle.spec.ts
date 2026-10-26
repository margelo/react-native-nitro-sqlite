import { afterEach, beforeEach, it } from '@tests/TestApi'
import { expect } from '@tests/unit/common'
import { eq, sql } from 'drizzle-orm'
import { blob, sqliteTable } from 'drizzle-orm/sqlite-core'
import { open } from 'react-native-nitro-sqlite'
import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import { drizzle, migrate } from 'react-native-nitro-sqlite-drizzle'
import type { NitroSQLiteDatabase } from 'react-native-nitro-sqlite-drizzle'
import migrations from 'react-native-nitro-sqlite-drizzle/src/__tests__/fixtures/drizzle/migrations'
import {
  pets,
  users,
} from 'react-native-nitro-sqlite-drizzle/src/__tests__/fixtures/schema'

const DB_NAME = 'test_drizzle'
let connection: NitroSQLiteConnection
let db: NitroSQLiteDatabase

export default function registerDrizzleUnitTests() {
  beforeEach(async () => {
    connection = open({ name: DB_NAME })
    db = drizzle(connection)
    await migrate(db, migrations)
  })

  afterEach(() => {
    connection.close()
    connection.delete()
  })

  it('applies drizzle-kit migrations once', async () => {
    await migrate(db, migrations)

    expect(
      connection.execute('SELECT created_at FROM __drizzle_migrations').results,
    ).toEqual(
      migrations.journal.entries.map((entry) => ({ created_at: entry.when })),
    )
  })

  it('round trips blob views and JSON through native bindings', async () => {
    connection.execute('CREATE TABLE files (content BLOB, metadata BLOB)')
    const files = sqliteTable('files', {
      content: blob('content', { mode: 'buffer' }).$type<Uint8Array>(),
      metadata: blob('metadata', { mode: 'json' }),
    })
    const bytes = Buffer.from([99, 1, 2, 88]).subarray(1, 3)
    const metadata = { name: 'receipt.jpg' }

    await db.insert(files).values({ content: bytes, metadata })

    expect(await db.select().from(files)).toEqual([
      { content: Buffer.from([1, 2]), metadata },
    ])
  })

  it('keeps both sides of a join whose columns share names', async () => {
    await db.insert(users).values([
      { id: 1, name: 'Dave' },
      { id: 2, name: 'Ritesh' },
    ])
    await db.insert(pets).values({ id: 7, name: 'Rex', ownerId: 1 })

    expect(
      await db
        .select()
        .from(users)
        .leftJoin(pets, eq(pets.ownerId, users.id))
        .orderBy(users.id),
    ).toEqual([
      {
        users: { id: 1, name: 'Dave' },
        pets: { id: 7, name: 'Rex', ownerId: 1 },
      },
      { users: { id: 2, name: 'Ritesh' }, pets: null },
    ])
  })

  it('runs raw SQL and prepared queries', async () => {
    await db.run(sql`INSERT INTO users (id, name) VALUES (1, 'Dave')`)

    expect(await db.all(sql`SELECT name FROM users`)).toEqual([
      { name: 'Dave' },
    ])
    expect(await db.values(sql`SELECT id, name FROM users`)).toEqual([
      [1, 'Dave'],
    ])

    const byId = db
      .select()
      .from(users)
      .where(eq(users.id, sql.placeholder('id')))
      .prepare()
    expect(await byId.get({ id: 1 })).toEqual({ id: 1, name: 'Dave' })
    expect(await byId.get({ id: 2 })).toBe(undefined)
  })

  it('commits transactions and rolls back savepoints', async () => {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id: 1, name: 'Dave' })
      await tx
        .transaction(async (nested) => {
          await nested.insert(users).values({ id: 2, name: 'Ritesh' })
          nested.rollback()
        })
        .catch(() => undefined)
    })

    expect(await db.select().from(users)).toEqual([{ id: 1, name: 'Dave' }])
  })

  it('rolls back when tx.rollback() is called', async () => {
    let error: unknown
    try {
      await db.transaction(async (tx) => {
        await tx.insert(users).values({ id: 1, name: 'Dave' })
        tx.rollback()
      })
    } catch (e) {
      error = e
    }

    expect((error as Error).message).toBe('Rollback')
    expect(await db.select().from(users)).toEqual([])
  })
}
