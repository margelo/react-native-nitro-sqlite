import { eq, sql, TransactionRollbackError } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { open, resetAllDatabases } from 'react-native-nitro-sqlite/mock'
import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import { drizzle } from '../index'

const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
})

const pets = sqliteTable('pets', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: integer('owner_id'),
})

function createDatabase() {
  const connection = open({ name: 'drizzle' }) as NitroSQLiteConnection
  connection.execute(
    'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)',
  )
  connection.execute(
    'CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT NOT NULL, owner_id INTEGER)',
  )
  return drizzle(connection)
}

afterEach(resetAllDatabases)

describe('drizzle', () => {
  it('inserts and selects rows', async () => {
    const db = createDatabase()
    await db.insert(users).values([
      { id: 1, name: 'Dave' },
      { id: 2, name: 'Ritesh' },
    ])

    expect(await db.select().from(users)).toEqual([
      { id: 1, name: 'Dave' },
      { id: 2, name: 'Ritesh' },
    ])
    expect(await db.select().from(users).where(eq(users.id, 2)).get()).toEqual({
      id: 2,
      name: 'Ritesh',
    })
  })

  it('keeps both sides of a join whose columns share names', async () => {
    const db = createDatabase()
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
    const db = createDatabase()
    await db.run(sql`INSERT INTO users (id, name) VALUES (1, 'Dave')`)

    expect(await db.all(sql`SELECT name FROM users`)).toEqual([
      { name: 'Dave' },
    ])
    expect(await db.get(sql`SELECT name FROM users`)).toEqual({ name: 'Dave' })
    expect(await db.values(sql`SELECT id, name FROM users`)).toEqual([
      [1, 'Dave'],
    ])

    const byId = db
      .select()
      .from(users)
      .where(eq(users.id, sql.placeholder('id')))
      .prepare()
    expect(await byId.get({ id: 1 })).toEqual({ id: 1, name: 'Dave' })
    expect(await byId.get({ id: 2 })).toBeUndefined()
  })

  it('commits transactions and rolls back savepoints and failures', async () => {
    const db = createDatabase()
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

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(users).values({ id: 3, name: 'Ada' })
        tx.rollback()
      }),
    ).rejects.toBeInstanceOf(TransactionRollbackError)
    expect(await db.select().from(users)).toEqual([{ id: 1, name: 'Dave' }])
  })
})
