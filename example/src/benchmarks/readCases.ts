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
const FRACTIONAL_ROWS = 100000
const POINT_READS = 1000
const CHUNK_SIZE = 1000
const NARROW_SCHEMA =
  'CREATE TABLE Bench (id INTEGER PRIMARY KEY, name TEXT NOT NULL, value INTEGER NOT NULL) STRICT'
const NARROW_INSERT = 'INSERT INTO Bench VALUES (?, ?, ?)'
const WIDE_INSERT =
  'INSERT INTO Test VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
const WIDE_SCHEMA =
  'CREATE TABLE Test (id INT PRIMARY KEY, v1 TEXT, v2 TEXT, v3 TEXT, v4 TEXT, v5 TEXT, v6 INT, v7 INT, v8 INT, v9 INT, v10 INT, v11 REAL, v12 REAL, v13 REAL, v14 REAL) STRICT'
const FRACTIONAL_SCHEMA =
  'CREATE TABLE Bench (id INTEGER PRIMARY KEY, price REAL NOT NULL, ratio REAL NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL) STRICT'
const FRACTIONAL_INSERT = 'INSERT INTO Bench VALUES (?, ?, ?, ?, ?)'

type NarrowRow = { id: number; name: string; value: number }
type WideRow = {
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
}
type FractionalRow = {
  id: number
  price: number
  ratio: number
  latitude: number
  longitude: number
}

const lookupIds = Array.from(
  { length: POINT_READS },
  (_, i) => (i * 37) % NARROW_ROWS,
)

export const readCases: BenchmarkCase[] = [
  {
    id: 'read-point-execute',
    label: '1k indexed lookups · execute',
    setup: () => setupPointReads('execute'),
  },
  {
    id: 'read-point-prepared',
    label: '1k indexed lookups · prepared',
    setup: () => setupPointReads('prepared'),
  },
  {
    id: 'read-narrow',
    label: '10k narrow rows · full read + access',
    setup: () => setupNarrowRead(false),
  },
  {
    id: 'read-wide',
    label: '300k wide rows · full read + access',
    measuredRuns: 3,
    setup: () => setupWideRead(false),
  },
  {
    id: 'read-narrow-async',
    label: '10k narrow rows · async read + access',
    setup: () => setupNarrowRead(true),
  },
  {
    id: 'read-wide-async',
    label: '300k wide rows · async read + access',
    measuredRuns: 3,
    setup: () => setupWideRead(true),
  },
  {
    id: 'read-fractional',
    label: '100k fractional REAL rows · full read + access',
    setup: setupFractionalRead,
  },
  {
    id: 'read-point-async',
    label: '1k indexed lookups · async',
    setup: () => setupPointReads('async'),
  },
  {
    id: 'read-narrow-raw',
    label: '10k narrow rows · raw arrays read + access',
    setup: setupNarrowRawRead,
  },
]

export function resetLargeDbSchema(db: NitroSQLiteConnection): void {
  db.executeBatch([
    { query: 'DROP TABLE IF EXISTS Test' },
    { query: WIDE_SCHEMA },
  ])
}

async function setupPointReads(
  mode: 'execute' | 'prepared' | 'async',
): Promise<BenchmarkFixture> {
  const db = createBenchmarkDatabase(`benchmark_point_${mode}`, NARROW_SCHEMA)
  try {
    await seedNarrowRows(db)
    const prepared = mode === 'prepared'
    const statement = prepared
      ? db.prepare('SELECT value FROM Bench WHERE id = ?')
      : undefined
    let checksum = 0
    const runAsync = async () => {
      checksum = 0
      for (const id of lookupIds) {
        const row = (
          await db.executeAsync<{
            value: number
          }>('SELECT value FROM Bench WHERE id = ?', [id])
        ).rows.item(0)
        assertBenchmark(row?.value === id, `Wrong value for row ${id}`)
        checksum += row.value
      }
    }

    return {
      database: db,
      run:
        mode === 'async'
          ? runAsync
          : () => {
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

async function setupNarrowRead(
  asynchronous: boolean,
): Promise<BenchmarkFixture> {
  const db = createBenchmarkDatabase(
    asynchronous ? 'benchmark_narrow_async' : 'benchmark_narrow',
    NARROW_SCHEMA,
  )
  try {
    await seedNarrowRows(db)
    let count = 0
    let checksum = 0
    const access = (rows: NarrowRow[]) => {
      count = rows.length
      checksum = 0
      for (const row of rows) checksum += row.id + row.value + row.name.length
    }

    return {
      database: db,
      run: asynchronous
        ? async () =>
            access(
              (await db.executeAsync<NarrowRow>('SELECT * FROM Bench')).rows
                ._array,
            )
        : () =>
            access(db.execute<NarrowRow>('SELECT * FROM Bench').rows._array),
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

async function setupNarrowRawRead(): Promise<BenchmarkFixture> {
  const db = createBenchmarkDatabase('benchmark_narrow_raw', NARROW_SCHEMA)
  try {
    await seedNarrowRows(db)
    let count = 0
    let checksum = 0

    return {
      database: db,
      run: () => {
        const rows = db.executeRaw('SELECT * FROM Bench').rows as [
          number,
          string,
          number,
        ][]
        count = rows.length
        checksum = 0
        for (const row of rows) checksum += row[0] + row[2] + row[1].length
      },
      verify: () => {
        assertBenchmark(count === NARROW_ROWS, 'Wrong raw read row count')
        assertBenchmark(
          checksum === narrowChecksum(),
          'Wrong raw read checksum',
        )
      },
      dispose: () => disposeBenchmarkDatabase(db),
    }
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

async function setupWideRead(asynchronous: boolean): Promise<BenchmarkFixture> {
  const db = open({
    name: asynchronous ? 'benchmark_wide_async' : 'benchmark_wide',
  })
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
    const access = (rows: WideRow[]) => {
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
    }
    return {
      database: db,
      run: asynchronous
        ? async () =>
            access(
              (await db.executeAsync<WideRow>('SELECT * FROM Test')).rows
                ._array,
            )
        : () => access(db.execute<WideRow>('SELECT * FROM Test').rows._array),
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

// The wide table stores whole numbers in its REAL columns. These rows store
// fractional values, which take a slower formatting path in native code.
async function setupFractionalRead(): Promise<BenchmarkFixture> {
  const db = createBenchmarkDatabase('benchmark_fractional', FRACTIONAL_SCHEMA)
  try {
    let expected = 0
    for (let start = 0; start < FRACTIONAL_ROWS; start += CHUNK_SIZE) {
      const params: SQLiteQueryParams[] = []
      for (
        let i = start;
        i < Math.min(start + CHUNK_SIZE, FRACTIONAL_ROWS);
        i++
      ) {
        const [price, ratio, latitude, longitude] = fractionalRow(i)
        params.push([i, price, ratio, latitude, longitude])
        expected += price + ratio + latitude + longitude
      }
      await db.executeBatchAsync([{ query: FRACTIONAL_INSERT, params }])
    }

    let count = 0
    let checksum = 0
    return {
      database: db,
      run: () => {
        const rows = db.execute<FractionalRow>(
          'SELECT * FROM Bench ORDER BY id',
        ).rows._array
        count = rows.length
        checksum = 0
        for (const row of rows) {
          checksum += row.price + row.ratio + row.latitude + row.longitude
        }
      },
      verify: () => {
        assertBenchmark(
          count === FRACTIONAL_ROWS,
          'Wrong fractional read row count',
        )
        assertBenchmark(checksum === expected, 'Wrong fractional read checksum')
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

function fractionalRow(i: number): [number, number, number, number] {
  return [
    (i % 100000) / 100 + 0.005,
    i / 7 + 0.5,
    48.2 + i * 1e-6,
    16.37 + i * 1e-6,
  ]
}
