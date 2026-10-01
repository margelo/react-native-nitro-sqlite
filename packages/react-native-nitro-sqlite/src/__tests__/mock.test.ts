import { NitroSQLite, open, resetAllDatabases } from '../mock'
import type { Transaction } from '../types'

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

  it('shares files across independent handles and preserves data after close', () => {
    const writer = open({ name: 'shared.sqlite' })
    writer.execute('CREATE TABLE notes (title TEXT)')
    writer.execute('INSERT INTO notes VALUES (?)', ['Draft'])
    const reader = open({
      name: 'shared.sqlite',
      connection: 'independent',
      readOnly: true,
    })
    expect(reader.execute('SELECT title FROM notes').results).toEqual([
      { title: 'Draft' },
    ])
    expect(() =>
      reader.execute('INSERT INTO notes VALUES (?)', ['Forbidden']),
    ).toThrow()
    expect(() => reader.delete()).toThrow('read-only')
    expect(() => writer.delete()).toThrow('another connection')
    reader.close()
    writer.close()
    const reopened = open({ name: 'shared.sqlite' })
    expect(reopened.execute('SELECT title FROM notes').rows.length).toBe(1)
    expect(() => writer.execute('SELECT 1')).toThrow('not open')
    expect(() => writer.delete()).toThrow('reopened')
    reopened.delete()
    const fresh = open({ name: 'shared.sqlite' })
    expect(() => fresh.execute('SELECT * FROM notes')).toThrow()
  })

  it('requires existing files for read-only opens without reserving a failed name', () => {
    expect(() => open({ name: 'missing.sqlite', readOnly: true })).toThrow()
    const writer = open({ name: 'missing.sqlite' })
    writer.execute('CREATE TABLE notes (title TEXT)')
    writer.close()
    const reader = open({ name: 'missing.sqlite', readOnly: true })
    expect(reader.execute('SELECT * FROM notes').rows.length).toBe(0)
  })

  it('isolates locations and rejects paths outside the temporary directory', () => {
    const first = open({ name: 'notes.sqlite', location: 'account-a' })
    first.execute('CREATE TABLE notes (title TEXT)')
    first.close()
    const second = open({ name: 'notes.sqlite', location: 'account-b' })
    expect(() => second.execute('SELECT * FROM notes')).toThrow()
    expect(() => open({ name: '../notes.sqlite' })).toThrow('file name')
    expect(() =>
      open({ name: 'escape.sqlite', location: '../outside' }),
    ).toThrow('temporary directory')
  })

  it('reuses prepared statements, replaces bindings, and finalizes idempotently', async () => {
    const database = open({ name: 'prepared.sqlite' })
    const statement = database.prepare(
      'SELECT :enabled AS enabled, :bytes AS bytes, :missing AS missing',
    )
    const bytes = Uint8Array.from([7, 8]).buffer
    expect(statement.execute([true, bytes, undefined]).rows.item(0)).toEqual({
      enabled: 1,
      bytes,
      missing: null,
    })
    expect(await statement.executeAsync([false, null, 'value'])).toMatchObject({
      results: [{ enabled: 0, bytes: null, missing: 'value' }],
    })
    expect(statement.execute().results).toEqual([
      { enabled: null, bytes: null, missing: null },
    ])
    const positional = database.prepare('SELECT ? AS first, ? AS second')
    expect(positional.execute(['Draft']).results).toEqual([
      { first: 'Draft', second: null },
    ])
    expect(positional.execute().results).toEqual([
      { first: null, second: null },
    ])
    positional.finalize()
    expect(statement.isFinalized).toBe(false)
    statement.finalize()
    statement.finalize()
    expect(statement.isFinalized).toBe(true)
    expect(() => statement.execute()).toThrow('finalized')
    await expect(statement.executeAsync()).rejects.toThrow('finalized')
    expect(() => database.prepare('INVALID SQL')).toThrow()
  })

  it('invalidates connections and statements on reset', async () => {
    const database = open({ name: 'reset.sqlite' })
    database.execute('CREATE TABLE notes (title TEXT)')
    const statement = database.prepare('SELECT * FROM notes')
    resetAllDatabases()
    expect(() => statement.execute()).toThrow('not open')
    await expect(database.executeAsync('SELECT 1')).rejects.toThrow('not open')
    await expect(statement.executeAsync()).rejects.toThrow('not open')
    const fresh = open({ name: 'reset.sqlite' })
    expect(() => fresh.execute('SELECT * FROM notes')).toThrow()
  })

  it('commits callback results and rolls back failures', async () => {
    const database = open({ name: 'transactions.sqlite' })
    database.execute('CREATE TABLE notes (title TEXT)')
    expect(
      await database.transaction(async (tx) => {
        await tx.executeAsync('INSERT INTO notes VALUES (?)', ['Draft'])
        return tx.execute('SELECT title FROM notes').rows.item(0)?.title
      }),
    ).toBe('Draft')
    await expect(
      database.transaction(async (tx) => {
        tx.execute('INSERT INTO notes VALUES (?)', ['Discard'])
        throw new Error('cancel')
      }),
    ).rejects.toThrow('cancel')
    expect(database.execute('SELECT title FROM notes').results).toEqual([
      { title: 'Draft' },
    ])
  })

  it('supports explicit commit and rollback and expires transaction handles', async () => {
    const database = open({ name: 'explicit.sqlite' })
    database.execute('CREATE TABLE notes (title TEXT)')
    let saved: Transaction | undefined
    await database.transaction(async (tx) => {
      saved = tx
      tx.execute('INSERT INTO notes VALUES (?)', ['Discard'])
      tx.rollback()
      expect(() => tx.commit()).toThrow('finalized')
    })
    expect(database.execute('SELECT * FROM notes').rows.length).toBe(0)
    await expect(
      database.transaction(async (tx) => {
        tx.execute('INSERT INTO notes VALUES (?)', ['Keep'])
        tx.commit()
        throw new Error('after commit')
      }),
    ).rejects.toThrow('after commit')
    expect(database.execute('SELECT title FROM notes').results).toEqual([
      { title: 'Keep' },
    ])
    if (!saved) throw new Error('Expected a transaction handle')
    const finalized = saved
    expect(() => finalized.execute('SELECT 1')).toThrow('finalized')
    await expect(finalized.executeAsync('SELECT 1')).rejects.toThrow(
      'finalized',
    )
  })

  it('keeps transactions exclusive across await and queues later work after rollback', async () => {
    const database = open({ name: 'exclusive.sqlite' })
    database.execute('CREATE TABLE notes (title TEXT)')
    const statement = database.prepare('INSERT INTO notes VALUES (?)')
    const gate = createGate()
    const transaction = database.transaction(async (tx) => {
      tx.execute('INSERT INTO notes VALUES (?)', ['Discard'])
      await gate.promise
      throw new Error('rollback')
    })
    const rejected = transaction.catch((error: unknown) => error)
    const insert = statement.executeAsync(['Keep'])
    const read = database.executeAsync('SELECT title FROM notes')
    expect(() => database.execute('SELECT 1')).toThrow('busy')
    expect(() => database.prepare('SELECT 1')).toThrow('busy')
    expect(() => statement.finalize()).toThrow('busy')
    expect(() => database.close()).toThrow('busy')
    expect(() => resetAllDatabases()).toThrow('busy')
    gate.release()
    expect(await rejected).toMatchObject({ message: 'rollback' })
    await insert
    expect((await read).results).toEqual([{ title: 'Keep' }])
    statement.finalize()
    database.close()
  })

  it('queues transactions and batches after pending statements in call order', async () => {
    const database = open({ name: 'fifo.sqlite' })
    database.execute('CREATE TABLE notes (title TEXT)')
    const first = database.executeAsync('INSERT INTO notes VALUES (?)', [
      'First',
    ])
    const transaction = database.transaction(async (tx) => {
      expect(tx.execute('SELECT title FROM notes').results).toEqual([
        { title: 'First' },
      ])
      await tx.executeAsync('INSERT INTO notes VALUES (?)', ['Second'])
    })
    const batch = database.executeBatchAsync([
      { query: 'INSERT INTO notes VALUES (?)', params: ['Third'] },
    ])
    await Promise.all([first, transaction, batch])
    expect(
      database.execute('SELECT title FROM notes ORDER BY rowid').results,
    ).toEqual([{ title: 'First' }, { title: 'Second' }, { title: 'Third' }])
  })

  it('guards synchronous transaction calls while async work is pending', async () => {
    const database = open({ name: 'pending.sqlite' })
    database.execute('CREATE TABLE notes (title TEXT)')
    await database.transaction(async (tx) => {
      const insert = tx.executeAsync('INSERT INTO notes VALUES (?)', ['Draft'])
      expect(() => tx.commit()).toThrow('Await all')
      expect(() => tx.rollback()).toThrow('Await all')
      expect(() => tx.execute('SELECT 1')).toThrow('Await all')
      await insert
    })
    expect(database.execute('SELECT * FROM notes').rows.length).toBe(1)
  })

  it('waits for pending transaction statements before rolling back a callback error', async () => {
    const database = open({ name: 'pending-error.sqlite' })
    database.execute('CREATE TABLE notes (title TEXT)')
    await expect(
      database.transaction(async (tx) => {
        const insert = tx.executeAsync('INSERT INTO notes VALUES (?)', [
          'Discard',
        ])
        insert.catch(() => undefined)
        throw new Error('cancel pending')
      }),
    ).rejects.toThrow('cancel pending')
    expect(database.execute('SELECT * FROM notes').rows.length).toBe(0)
  })

  it('reads one WAL snapshot while an independent connection commits a write', async () => {
    const writer = open({ name: 'snapshot.sqlite' })
    writer.execute('PRAGMA journal_mode = WAL')
    writer.execute('CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT)')
    writer.execute('INSERT INTO notes VALUES (1, ?)', ['Draft'])
    const reader = open({
      name: 'snapshot.sqlite',
      connection: 'independent',
      readOnly: true,
    })
    const started = createGate()
    const resume = createGate()
    const snapshot = reader.transaction(async (tx) => {
      const before = await tx.executeAsync('SELECT title FROM notes')
      started.release()
      await resume.promise
      const after = await tx.executeAsync('SELECT title FROM notes')
      return [before.results, after.results]
    })
    await started.promise
    await writer.executeAsync('UPDATE notes SET title = ?', ['Published'])
    resume.release()
    expect(await snapshot).toEqual([[{ title: 'Draft' }], [{ title: 'Draft' }]])
    expect(reader.execute('SELECT title FROM notes').results).toEqual([
      { title: 'Published' },
    ])
  })
})

function createGate() {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}
