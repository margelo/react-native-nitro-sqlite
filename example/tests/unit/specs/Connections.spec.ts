import { describe, it } from '@tests/TestApi'
import { expect } from '@tests/unit/common'
import {
  NitroSQLite,
  NitroSQLiteError,
  open,
  type NitroSQLiteConnection,
} from 'react-native-nitro-sqlite'

const TIMEOUT_MS = 5000

export default function registerConnectionUnitTests() {
  describe('independent connections', () => {
    it('keeps the default name lookup separate from independent handles', () => {
      const name = 'connections-default-lookup'
      const writer = open({ name })
      const other = open({ name, connection: 'independent' })
      let writerOpen = true

      try {
        writer.execute('CREATE TABLE Item (value TEXT)')
        other.execute('CREATE TEMP TABLE PrivateItem (value TEXT)')
        other.execute('INSERT INTO PrivateItem VALUES (?)', ['private'])
        NitroSQLite.execute(name, 'INSERT INTO Item VALUES (?)', ['default'])

        expect(writer.execute('SELECT value FROM Item').results).toEqual([
          { value: 'default' },
        ])
        expect(other.execute('SELECT value FROM Item').results).toEqual([
          { value: 'default' },
        ])
        expect(other.execute('SELECT value FROM PrivateItem').results).toEqual([
          { value: 'private' },
        ])
        expectThrows(() =>
          NitroSQLite.execute(name, 'SELECT * FROM PrivateItem'),
        )
        expectThrows(() => open({ name }))

        writer.close()
        writerOpen = false
        expectThrows(() => NitroSQLite.execute(name, 'SELECT 1'))
        expect(other.execute('SELECT value FROM Item').results).toEqual([
          { value: 'default' },
        ])
      } finally {
        other.close()
        if (writerOpen) writer.close()
        writer.delete()
      }
    })

    it('opens the same filename in different locations as different files', () => {
      const name = 'connections-location'
      const first = open({ name })
      const second = open({ name, location: '..', connection: 'independent' })

      try {
        first.execute('CREATE TABLE Item (value TEXT)')
        second.execute('CREATE TABLE Item (value TEXT)')
        first.execute('INSERT INTO Item VALUES (?)', ['first'])
        second.execute('INSERT INTO Item VALUES (?)', ['second'])

        expect(first.execute('SELECT value FROM Item').results).toEqual([
          { value: 'first' },
        ])
        expect(second.execute('SELECT value FROM Item').results).toEqual([
          { value: 'second' },
        ])
        expect(mainPath(first)).not.toBe(mainPath(second))
      } finally {
        second.close()
        first.close()
        second.delete()
        first.delete()
      }
    })

    it('reads committed data while a WAL writer callback is held open', async () => {
      const writer = open({ name: 'connections-wal-reader' })
      writer.execute('PRAGMA journal_mode = WAL')
      writer.execute('CREATE TABLE Item (value TEXT)')
      writer.execute('INSERT INTO Item VALUES (?)', ['committed'])
      const reader = open({
        name: 'connections-wal-reader',
        connection: 'independent',
        readOnly: true,
      })
      const started = gate()
      const release = gate()
      const write = writer.transaction(async (tx) => {
        tx.execute('INSERT INTO Item VALUES (?)', ['uncommitted'])
        started.resolve()
        await release.promise
      })
      let pendingRead: ReturnType<typeof reader.executeAsync> | undefined

      try {
        await bounded(Promise.race([started.promise, rejectIfSettled(write)]))
        pendingRead = reader.executeAsync(
          'SELECT value FROM Item ORDER BY rowid',
        )
        const rows = await bounded(pendingRead)
        expect(rows.results).toEqual([{ value: 'committed' }])

        release.resolve()
        await bounded(write)
        expect(
          reader.execute('SELECT value FROM Item ORDER BY rowid').results,
        ).toEqual([{ value: 'committed' }, { value: 'uncommitted' }])
      } finally {
        release.resolve()
        try {
          await Promise.allSettled([
            bounded(write),
            ...(pendingRead ? [bounded(pendingRead)] : []),
          ])
        } finally {
          reader.close()
          writer.close()
          writer.delete()
        }
      }
    })

    it('keeps a reader transaction snapshot across a writer commit', async () => {
      const writer = open({ name: 'connections-snapshot' })
      writer.execute('PRAGMA journal_mode = WAL')
      writer.execute('CREATE TABLE Item (value TEXT)')
      writer.execute('INSERT INTO Item VALUES (?)', ['before'])
      const reader = open({
        name: 'connections-snapshot',
        connection: 'independent',
        readOnly: true,
      })
      const snapshotReady = gate()
      const release = gate()
      const read = reader.transaction(async (tx) => {
        const initial = tx.execute(
          'SELECT value FROM Item ORDER BY rowid',
        ).results
        snapshotReady.resolve()
        await release.promise
        const afterCommit = tx.execute(
          'SELECT value FROM Item ORDER BY rowid',
        ).results
        return { initial, afterCommit }
      })
      let pendingWrite: Promise<unknown> | undefined

      try {
        await bounded(
          Promise.race([snapshotReady.promise, rejectIfSettled(read)]),
        )
        pendingWrite = writer.executeAsync('INSERT INTO Item VALUES (?)', [
          'after',
        ])
        await bounded(pendingWrite)
        release.resolve()

        const snapshot = await bounded(read)
        expect(snapshot.initial).toEqual([{ value: 'before' }])
        expect(snapshot.afterCommit).toEqual([{ value: 'before' }])
        expect(
          reader.execute('SELECT value FROM Item ORDER BY rowid').results,
        ).toEqual([{ value: 'before' }, { value: 'after' }])
      } finally {
        release.resolve()
        try {
          await Promise.allSettled([
            bounded(read),
            ...(pendingWrite ? [bounded(pendingWrite)] : []),
          ])
        } finally {
          reader.close()
          writer.close()
          writer.delete()
        }
      }
    })

    it('keeps temporary tables, pragmas, and attachments on their own handles', () => {
      const name = 'connections-local-state'
      const auxiliaryName = 'connections-local-state-aux'
      const first = open({ name })
      const second = open({ name, connection: 'independent' })
      const auxiliary = open({ name: auxiliaryName })
      let attached = false

      try {
        first.execute('CREATE TEMP TABLE PrivateItem (value TEXT)')
        first.execute('PRAGMA foreign_keys = ON')
        second.execute('PRAGMA foreign_keys = OFF')
        first.attach(auxiliaryName, 'extra')
        attached = true

        expect(first.execute('PRAGMA foreign_keys').results).toEqual([
          { foreign_keys: 1 },
        ])
        expect(second.execute('PRAGMA foreign_keys').results).toEqual([
          { foreign_keys: 0 },
        ])
        expectThrows(() => second.execute('SELECT * FROM PrivateItem'))
        expect(databaseNames(first)).toContain('extra')
        expect(databaseNames(second)).toEqual(['main'])
      } finally {
        if (attached) first.detach('extra')
        auxiliary.close()
        auxiliary.delete()
        second.close()
        first.close()
        first.delete()
      }
    })

    it('enforces read-only handles without limiting a writable peer', () => {
      const name = 'connections-read-only'
      const writer = open({ name })
      writer.execute('CREATE TABLE Item (value TEXT)')
      const reader = open({ name, connection: 'independent', readOnly: true })

      try {
        expectThrows(() =>
          reader.execute('INSERT INTO Item VALUES (?)', ['blocked']),
        )
        expectThrows(() => reader.delete())
        writer.execute('INSERT INTO Item VALUES (?)', ['allowed'])
        expect(reader.execute('SELECT value FROM Item').results).toEqual([
          { value: 'allowed' },
        ])
      } finally {
        reader.close()
        writer.close()
        writer.delete()
      }
    })

    it('allows only one writer at a time', async () => {
      const name = 'connections-writer-contention'
      const first = open({ name })
      first.execute('CREATE TABLE Item (value TEXT)')
      const second = open({ name, connection: 'independent' })
      second.execute('PRAGMA busy_timeout = 0')
      const started = gate()
      const release = gate()
      const write = first.transaction(async (tx) => {
        tx.execute('INSERT INTO Item VALUES (?)', ['first'])
        started.resolve()
        await release.promise
      })

      try {
        await bounded(Promise.race([started.promise, rejectIfSettled(write)]))
        expectThrows(() =>
          second.execute('INSERT INTO Item VALUES (?)', ['blocked']),
        )
        release.resolve()
        await bounded(write)
        second.execute('INSERT INTO Item VALUES (?)', ['second'])
        expect(
          first.execute('SELECT value FROM Item ORDER BY rowid').results,
        ).toEqual([{ value: 'first' }, { value: 'second' }])
      } finally {
        release.resolve()
        try {
          await bounded(write)
        } finally {
          second.close()
          first.close()
          first.delete()
        }
      }
    })

    it('rejects deletion while a peer handle is open and preserves both handles', () => {
      const name = 'connections-delete-peer'
      const first = open({ name })
      first.execute('CREATE TABLE Item (value TEXT)')
      const second = open({ name, connection: 'independent' })

      try {
        expectThrows(() => first.delete())
        expectThrows(() => second.delete())
        first.execute('INSERT INTO Item VALUES (?)', ['still open'])
        expect(second.execute('SELECT value FROM Item').results).toEqual([
          { value: 'still open' },
        ])
      } finally {
        second.close()
        first.close()
        first.delete()
      }
    })

    it('rejects deletion while raw SQL ATTACH holds the file', () => {
      const name = 'connections-delete-attached'
      const target = open({ name })
      const holder = open({ name: 'connections-attachment-holder' })
      let attached = false

      try {
        target.execute('CREATE TABLE Item (value TEXT)')
        holder.execute('ATTACH DATABASE ? AS held', [mainPath(target)])
        attached = true
        expectThrows(() => target.delete())
        target.execute('INSERT INTO Item VALUES (?)', ['still open'])
        expect(holder.execute('SELECT value FROM held.Item').results).toEqual([
          { value: 'still open' },
        ])
      } finally {
        if (attached) holder.execute('DETACH DATABASE held')
        holder.close()
        holder.delete()
        target.close()
        target.delete()
      }
    })
  })
}

function gate() {
  let resolve!: () => void
  const promise = new Promise<void>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}

async function bounded<Result>(promise: Promise<Result>): Promise<Result> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<Result>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Connection test timed out')),
          TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timeout != null) clearTimeout(timeout)
  }
}

function rejectIfSettled(promise: Promise<unknown>): Promise<never> {
  return promise.then(() => {
    throw new Error('Transaction finished before its callback reached the gate')
  })
}

function expectThrows(action: () => unknown) {
  let error: unknown
  try {
    action()
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(NitroSQLiteError)
}

function mainPath(connection: NitroSQLiteConnection): string {
  const main = connection
    .execute<{ name: string; file: string }>('PRAGMA database_list')
    .results.find((row) => row.name === 'main')
  if (typeof main?.file !== 'string')
    throw new Error('Missing main database path')
  return main.file
}

function databaseNames(connection: NitroSQLiteConnection): string[] {
  return connection
    .execute<{ name: string }>('PRAGMA database_list')
    .results.map((row) => row.name)
    .filter((name): name is string => typeof name === 'string')
}
