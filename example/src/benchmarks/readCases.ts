import { open, type NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import type { SQLiteQueryParams } from 'react-native-nitro-sqlite'
import type { BenchmarkCase, BenchmarkFixture } from './runner'
import {
  assertBenchmark,
  createBenchmarkDatabase,
  disposeBenchmarkDatabase,
} from './database'

const NARROW_ROWS = 10000
const WIDE_ROWS = 300000
const POINT_READS = 1000
const CHUNK_SIZE = 1000
const NARROW_SCHEMA =
  'CREATE TABLE Bench (id INTEGER PRIMARY KEY, name TEXT NOT NULL, value INTEGER NOT NULL) STRICT'
const NARROW_INSERT = 'INSERT INTO Bench VALUES (?, ?, ?)'
const WIDE_INSERT =
  'INSERT INTO Test VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
const WIDE_SCHEMA =
  'CREATE TABLE Test (id INT PRIMARY KEY, v1 TEXT, v2 TEXT, v3 TEXT, v4 TEXT, v5 TEXT, v6 INT, v7 INT, v8 INT, v9 INT, v10 INT, v11 REAL, v12 REAL, v13 REAL, v14 REAL) STRICT'

const lookupIds = Array.from(
  { length: POINT_READS },
  (_, i) => (i * 37) % NARROW_ROWS,
)

export const readCases: BenchmarkCase[] = [
  {
    id: 'read-point-execute',
    label: '1k indexed lookups · execute',
    setup: () => setupPointReads(false),
  },
  {
    id: 'read-point-prepared',
    label: '1k indexed lookups · prepared',
    setup: () => setupPointReads(true),
  },
  {
    id: 'read-narrow',
    label: '10k narrow rows · full read + access',
    setup: setupNarrowRead,
  },
  {
    id: 'read-wide',
    label: '300k wide rows · full read + access',
    measuredRuns: 3,
    setup: setupWideRead,
  },
]

export function resetLargeDbSchema(db: NitroSQLiteConnection): void {
  db.executeBatch([
    { query: 'DROP TABLE IF EXISTS Test' },
    { query: WIDE_SCHEMA },
  ])
}

async function setupPointReads(prepared: boolean): Promise<BenchmarkFixture> {
  const db = createBenchmarkDatabase(
    `benchmark_point_${prepared ? 'prepared' : 'execute'}`,
    NARROW_SCHEMA,
  )
  try {
    await seedNarrowRows(db)
    const statement = prepared
      ? db.prepare('SELECT value FROM Bench WHERE id = ?')
      : undefined
    let checksum = 0

    return {
      database: db,
      run: () => {
        checksum = 0
        for (const id of lookupIds) {
          const row = prepared
            ? statement?.execute<{ value: number }>([id]).rows.item(0)
            : db
                .execute<{
                  value: number
                }>('SELECT value FROM Bench WHERE id = ?', [id])
                .rows.item(0)
          assertBenchmark(row?.value === id, `Wrong value for row ${id}`)
          checksum += row.value
        }
      },
      verify: () => {
        const expected = lookupIds.reduce((sum, id) => sum + id, 0)
        assertBenchmark(checksum === expected, 'Wrong lookup checksum')
      },
      dispose: () => {
        statement?.finalize()
        disposeBenchmarkDatabase(db)
      },
    }
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

async function setupNarrowRead(): Promise<BenchmarkFixture> {
  const db = createBenchmarkDatabase('benchmark_narrow', NARROW_SCHEMA)
  try {
    await seedNarrowRows(db)
    let count = 0
    let checksum = 0

    return {
      database: db,
      run: () => {
        const rows = db.execute<{
          id: number
          name: string
          value: number
        }>('SELECT * FROM Bench').rows._array
        count = rows.length
        checksum = 0
        for (const row of rows) checksum += row.id + row.value + row.name.length
      },
      verify: () => {
        assertBenchmark(count === NARROW_ROWS, 'Wrong narrow read row count')
        assertBenchmark(
          checksum === narrowChecksum(),
          'Wrong narrow read checksum',
        )
      },
      dispose: () => disposeBenchmarkDatabase(db),
    }
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

async function setupWideRead(): Promise<BenchmarkFixture> {
  const db = open({ name: 'benchmark_wide' })
  try {
    resetLargeDbSchema(db)
    let expected = 0

    for (let start = 0; start < WIDE_ROWS; start += CHUNK_SIZE) {
      const params: SQLiteQueryParams[] = []
      for (let i = start; i < Math.min(start + CHUNK_SIZE, WIDE_ROWS); i++) {
        params.push(wideRow(i))
        expected += wideRowChecksum(i)
      }
      await db.executeBatchAsync([{ query: WIDE_INSERT, params }])
    }

    let count = 0
    let checksum = 0
    return {
      database: db,
      run: () => {
        const rows = db.execute<{
          id: number
          v1: string
          v2: string
          v3: string
          v4: string
          v5: string
          v6: number
          v7: number
          v8: number
          v9: number
          v10: number
          v11: number
          v12: number
          v13: number
          v14: number
        }>('SELECT * FROM Test').rows._array
        count = rows.length
        checksum = 0
        for (const row of rows) {
          checksum +=
            row.id +
            row.v1.length +
            row.v2.length +
            row.v3.length +
            row.v4.length +
            row.v5.length +
            row.v6 +
            row.v7 +
            row.v8 +
            row.v9 +
            row.v10 +
            row.v11 +
            row.v12 +
            row.v13 +
            row.v14
        }
      },
      verify: () => {
        assertBenchmark(count === WIDE_ROWS, 'Wrong wide read row count')
        assertBenchmark(checksum === expected, 'Wrong wide read checksum')
      },
      dispose: () => disposeBenchmarkDatabase(db),
    }
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

async function seedNarrowRows(db: NitroSQLiteConnection): Promise<void> {
  const params: SQLiteQueryParams[] = Array.from(
    { length: NARROW_ROWS },
    (_, i) => [i, `name_${i}`, i],
  )
  await db.executeBatchAsync([{ query: NARROW_INSERT, params }])
}

function narrowChecksum(): number {
  let sum = 0
  for (let i = 0; i < NARROW_ROWS; i++) sum += i * 2 + `name_${i}`.length
  return sum
}

function wideRow(i: number): SQLiteQueryParams {
  const name = `n${i % 1000}`
  return [
    i,
    name,
    name,
    name,
    name,
    name,
    i,
    i + 1,
    i + 2,
    i + 3,
    i + 4,
    i + 5,
    i + 6,
    i + 7,
    i + 8,
  ]
}

function wideRowChecksum(i: number): number {
  return 10 * i + 36 + 5 * `n${i % 1000}`.length
}
