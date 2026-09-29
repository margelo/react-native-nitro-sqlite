import { NitroSQLite, open, resetAllDatabases } from '../mock'

afterEach(resetAllDatabases)

describe('Node SQLite mock', () => {
  it('runs queries and returns Nitro-shaped rows', async () => {
    const database = open({ name: 'users' })
    database.execute('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)')

    const inserted = await database.executeAsync(
      'INSERT INTO users (name) VALUES (?)',
      ['Ada'],
    )
    expect(inserted).toMatchObject({
      rowsAffected: 1,
      insertId: 1,
      results: [],
    })

    const result = database.execute<{ id: number; name: string }>(
      'SELECT id, name FROM users',
    )
    expect(result.results).toEqual([{ id: 1, name: 'Ada' }])
    expect(result.rows._array).toEqual(result.results)
    expect(result.rows.item(0)).toEqual({ id: 1, name: 'Ada' })
    expect(result.rows.item(1)).toBeUndefined()
    expect(result.rows.length).toBe(1)
    expect(NitroSQLite.open).toBe(open)
  })

  it('binds repeated named parameters in first-occurrence order', () => {
    const database = open({ name: 'named' })
    expect(
      database.execute(
        'SELECT :key AS first, :value AS second, :value AS third',
        ['name', 'value'],
      ).results,
    ).toEqual([{ first: 'name', second: 'value', third: 'value' }])
    expect(
      database.execute(
        "SELECT ':ignored' AS literal, :key AS bound -- :comment",
        ['value'],
      ).results,
    ).toEqual([{ literal: ':ignored', bound: 'value' }])
  })

  it('expands batch parameters and rolls the batch back on error', async () => {
    const database = open({ name: 'batch' })
    database.execute('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)')

    await expect(
      database.executeBatchAsync([
        {
          query: 'INSERT INTO items (id, value) VALUES (?, ?)',
          params: [
            [1, 'one'],
            [2, 'two'],
          ],
        },
      ]),
    ).resolves.toEqual({ rowsAffected: 2 })

    expect(() =>
      database.executeBatch([
        {
          query: 'INSERT INTO items (id, value) VALUES (?, ?)',
          params: [3, 'three'],
        },
        {
          query: 'INSERT INTO items (id, value) VALUES (?, ?)',
          params: [1, 'duplicate'],
        },
      ]),
    ).toThrow()
    expect(
      database.execute('SELECT id FROM items ORDER BY id').results,
    ).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('converts booleans and blobs to the native value shape', () => {
    const database = open({ name: 'values' })
    database.execute('CREATE TABLE values_test (enabled INTEGER, bytes BLOB)')
    const bytes = Uint8Array.from([1, 2, 3]).buffer
    database.execute('INSERT INTO values_test VALUES (?, ?)', [true, bytes])

    const result = database.execute('SELECT enabled, bytes FROM values_test')
    expect(result.results[0]?.enabled).toBe(1)
    const returnedBytes = result.results[0]?.bytes
    expect(returnedBytes).toBeInstanceOf(ArrayBuffer)
    if (!(returnedBytes instanceof ArrayBuffer)) {
      throw new Error('Expected an ArrayBuffer result')
    }
    expect(new Uint8Array(returnedBytes)).toEqual(Uint8Array.from([1, 2, 3]))
    expect(
      database.execute('SELECT ? AS missing', [undefined]).results,
    ).toEqual([{ missing: null }])
  })

  it('keeps names isolated and clears them between tests', () => {
    const first = open({ name: 'first' })
    const second = open({ name: 'second' })
    first.execute('CREATE TABLE items (id INTEGER)')
    expect(() => second.execute('SELECT * FROM items')).toThrow()
    expect(() => open({ name: 'first' })).toThrow('already open')

    resetAllDatabases()
    const fresh = open({ name: 'first' })
    expect(() => fresh.execute('SELECT * FROM items')).toThrow()
  })
})
