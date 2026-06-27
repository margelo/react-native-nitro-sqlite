import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'react-native-harness'
import { open, NitroSQLiteError } from 'react-native-nitro-sqlite'
import type {
  NitroSQLiteConnection,
  BatchQueryCommand,
} from 'react-native-nitro-sqlite'

const DB_NAME = 'harness_test'
const USER_TABLE =
  'CREATE TABLE User (id REAL PRIMARY KEY, name TEXT NOT NULL, age REAL, networth REAL) STRICT;'
const INSERT_USER =
  'INSERT INTO "User" (id, name, age, networth) VALUES(?, ?, ?, ?)'

let db: NitroSQLiteConnection

function closeQuietly(connection: NitroSQLiteConnection | undefined) {
  if (connection == null) return
  try {
    connection.close()
    connection.delete()
  } catch {
    // already closed / deleted
  }
}

function resetDb() {
  closeQuietly(db)
  db = open({ name: DB_NAME })
  db.execute('DROP TABLE IF EXISTS User;')
  db.execute(USER_TABLE)
}

describe('NitroSQLite - open / close', () => {
  it('opens, closes, and deletes a database without throwing', () => {
    const conn = open({ name: 'harness_open_close' })
    expect(conn).toBeDefined()
    conn.close()
    conn.delete()
  })
})

describe('NitroSQLite - execute', () => {
  beforeEach(resetDb)
  afterAll(() => closeQuietly(db))

  it('INSERT returns rowsAffected=1, insertId, and an empty rows set', () => {
    const res = db.execute(INSERT_USER, [1, 'Alice', 30, 1000.5])
    expect(res.rowsAffected).toBe(1)
    expect(res.insertId).toBe(1)
    expect(res.rows?.length).toBe(0)
    expect(res.rows?._array).toEqual([])
    expect(typeof res.rows?.item).toBe('function')
  })

  it('INSERT then SELECT round-trips all column values', () => {
    db.execute(INSERT_USER, [2, 'Bob', 25, 42.5])
    const res = db.execute('SELECT * FROM User')
    expect(res.rows?._array).toEqual([
      { id: 2, name: 'Bob', age: 25, networth: 42.5 },
    ])
  })

  it('stores and reads NULL values', () => {
    db.execute(INSERT_USER, [3, 'Carol', null, null])
    const res = db.execute('SELECT * FROM User WHERE id = ?', [3])
    expect(res.rows?._array).toEqual([
      { id: 3, name: 'Carol', age: null, networth: null },
    ])
  })

  it('SELECT with a bound WHERE parameter returns the matching row', () => {
    db.execute(INSERT_USER, [4, 'Dan', 40, 99])
    db.execute(INSERT_USER, [5, 'Eve', 50, 88])
    const res = db.execute('SELECT * FROM User WHERE id = ?', [5])
    expect(res.rows?._array).toEqual([
      { id: 5, name: 'Eve', age: 50, networth: 88 },
    ])
  })

  it('throws a NitroSQLiteError on a STRICT type mismatch', () => {
    let threw = false
    try {
      db.execute(INSERT_USER, [6, 'Frank', 'not-a-number', 10])
    } catch (e) {
      threw = true
      expect(e instanceof NitroSQLiteError).toBe(true)
      expect((e as Error).message).toContain(
        'cannot store TEXT value in REAL column User.age',
      )
    }
    expect(threw).toBe(true)
  })

  it('executeAsync round-trips values', async () => {
    await db.executeAsync(INSERT_USER, [7, 'Grace', 33, 7.7])
    const res = await db.executeAsync('SELECT * FROM User WHERE id = ?', [7])
    expect(res.rows?._array).toEqual([
      { id: 7, name: 'Grace', age: 33, networth: 7.7 },
    ])
  })
})

describe('NitroSQLite - transaction', () => {
  beforeEach(resetDb)
  afterAll(() => closeQuietly(db))

  it('commits writes when the callback resolves', async () => {
    await db.transaction(async (tx) => {
      tx.execute(INSERT_USER, [1, 'Tx', 20, 1])
    })
    const res = db.execute('SELECT * FROM User')
    expect(res.rows?._array).toEqual([
      { id: 1, name: 'Tx', age: 20, networth: 1 },
    ])
  })

  it('discards writes after a manual rollback', async () => {
    await db.transaction(async (tx) => {
      tx.execute(INSERT_USER, [2, 'Rollback', 20, 1])
      tx.rollback()
    })
    const res = db.execute('SELECT * FROM User')
    expect(res.rows?._array).toEqual([])
  })

  it('rejects with NitroSQLiteError (and auto-rolls back) on a bad query', async () => {
    let threw = false
    try {
      await db.transaction(async (tx) => {
        await tx.executeAsync('SELECT * FROM [tableThatDoesNotExist];')
      })
    } catch (e) {
      threw = true
      expect(e instanceof NitroSQLiteError).toBe(true)
      expect((e as Error).message).toContain(
        'no such table: tableThatDoesNotExist',
      )
    }
    expect(threw).toBe(true)
  })
})

describe('NitroSQLite - executeBatch', () => {
  beforeEach(resetDb)
  afterAll(() => closeQuietly(db))

  it('runs multiple inserts in a single batch', () => {
    const commands: BatchQueryCommand[] = [
      { query: INSERT_USER, params: [1, 'A', 1, 1] },
      { query: INSERT_USER, params: [2, 'B', 2, 2] },
    ]
    db.executeBatch(commands)
    const res = db.execute('SELECT * FROM User ORDER BY id')
    expect(res.rows?._array).toEqual([
      { id: 1, name: 'A', age: 1, networth: 1 },
      { id: 2, name: 'B', age: 2, networth: 2 },
    ])
  })

  it('executeBatchAsync inserts rows', async () => {
    await db.executeBatchAsync([{ query: INSERT_USER, params: [3, 'C', 3, 3] }])
    const res = db.execute('SELECT COUNT(*) AS c FROM User')
    expect(res.rows?._array?.[0]?.c).toBe(1)
  })
})

describe('NitroSQLite - ArrayBuffer / BLOB', () => {
  it('stores and reads an ArrayBuffer from a BLOB column', () => {
    const blobDb = open({ name: 'harness_blob' })
    blobDb.execute('DROP TABLE IF EXISTS BlobData;')
    blobDb.execute(
      'CREATE TABLE BlobData (id INTEGER PRIMARY KEY, data BLOB NOT NULL) STRICT;',
    )
    try {
      const original = new Uint8Array([10, 20, 30, 40])
      blobDb.execute('INSERT INTO BlobData (id, data) VALUES (?, ?)', [
        1,
        original.buffer,
      ])
      const res = blobDb.execute('SELECT data FROM BlobData WHERE id = ?', [1])
      const value = res.results[0]?.data
      expect(value instanceof ArrayBuffer).toBe(true)
      expect(Array.from(new Uint8Array(value as ArrayBuffer))).toEqual([
        10, 20, 30, 40,
      ])
    } finally {
      closeQuietly(blobDb)
    }
  })
})

describe('NitroSQLite - Int64 / bigint params', () => {
  it('binds a bigint as an exact int64 (value beyond 2^53)', () => {
    const bigDb = open({ name: 'harness_int64' })
    bigDb.execute('DROP TABLE IF EXISTS Big;')
    bigDb.execute(
      'CREATE TABLE Big (id INTEGER PRIMARY KEY, label TEXT) STRICT;',
    )
    try {
      // 2^53 + 1 — not representable as a JS number, only as a bigint.
      const big = 9007199254740993n
      bigDb.execute('INSERT INTO Big (id, label) VALUES (?, ?)', [big, 'x'])
      // Compare inside SQLite (int64) to avoid the lossy double round-trip on read-back.
      const res = bigDb.execute(
        'SELECT (id = ?) AS matches, typeof(id) AS t FROM Big WHERE label = ?',
        [big, 'x'],
      )
      expect(res.rows?.item(0)?.matches).toBe(1)
      expect(res.rows?.item(0)?.t).toBe('integer')
    } finally {
      closeQuietly(bigDb)
    }
  })

  it('a whole `number` still binds as INTEGER (heuristic preserved)', () => {
    const numDb = open({ name: 'harness_int64_num' })
    numDb.execute('DROP TABLE IF EXISTS Whole;')
    numDb.execute('CREATE TABLE Whole (id INTEGER PRIMARY KEY) STRICT;')
    try {
      numDb.execute('INSERT INTO Whole (id) VALUES (?)', [42])
      const res = numDb.execute('SELECT typeof(id) AS t FROM Whole')
      expect(res.rows?.item(0)?.t).toBe('integer')
    } finally {
      closeQuietly(numDb)
    }
  })
})
