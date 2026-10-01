import type {
  NitroSQLiteConnection,
  PreparedStatement,
  SQLiteQueryParams,
} from 'react-native-nitro-sqlite'
import type { BenchmarkCase, BenchmarkFixture } from './runner'
import {
  assertBenchmark,
  createBenchmarkDatabase,
  disposeBenchmarkDatabase,
} from './database'

const ROW_COUNT = 1000
const EXPECTED_SUM = (ROW_COUNT * (ROW_COUNT - 1)) / 2
const INSERT_SQL = 'INSERT INTO Bench (id, name, value) VALUES (?, ?, ?)'
const SCHEMA =
  'CREATE TABLE Bench (id INTEGER PRIMARY KEY, name TEXT NOT NULL, value INTEGER NOT NULL) STRICT'

type WriteMethod =
  | 'execute'
  | 'prepared'
  | 'batch'
  | 'asyncSequential'
  | 'asyncQueued'
  | 'transaction'
  | 'batchAsync'

const methods: { method: WriteMethod; label: string }[] = [
  { method: 'execute', label: '1k inserts · sync execute' },
  { method: 'prepared', label: '1k inserts · prepared execute' },
  { method: 'batch', label: '1k inserts · sync batch' },
  { method: 'asyncSequential', label: '1k inserts · async sequential' },
  { method: 'asyncQueued', label: '1k inserts · async queued' },
  { method: 'transaction', label: '1k inserts · async transaction' },
  { method: 'batchAsync', label: '1k inserts · async batch' },
]

export const writeCases: BenchmarkCase[] = methods.map(({ method, label }) => ({
  id: `write-${method}`,
  label,
  setup: () => setupWriteCase(method),
}))

function setupWriteCase(method: WriteMethod): BenchmarkFixture {
  const db = createBenchmarkDatabase(`benchmark_${method}`, SCHEMA)
  const rows: SQLiteQueryParams[] = Array.from(
    { length: ROW_COUNT },
    (_, i) => [i, `name_${i}`, i],
  )
  const statement = method === 'prepared' ? db.prepare(INSERT_SQL) : undefined

  return {
    database: db,
    reset: () => {
      db.execute('DELETE FROM Bench')
    },
    run: () => runWriteCase(method, db, rows, statement),
    verify: () => {
      const row = db
        .execute<{
          count: number
          total: number
        }>('SELECT COUNT(*) AS count, SUM(value) AS total FROM Bench')
        .rows.item(0)
      assertBenchmark(row?.count === ROW_COUNT, `${method}: wrong row count`)
      assertBenchmark(row.total === EXPECTED_SUM, `${method}: wrong value sum`)
    },
    dispose: () => {
      statement?.finalize()
      disposeBenchmarkDatabase(db)
    },
  }
}

function runWriteCase(
  method: WriteMethod,
  db: NitroSQLiteConnection,
  rows: SQLiteQueryParams[],
  statement?: PreparedStatement,
): void | Promise<void> {
  switch (method) {
    case 'execute':
      for (const params of rows) db.execute(INSERT_SQL, params)
      return
    case 'prepared':
      assertBenchmark(statement != null, 'Prepared statement is missing')
      for (const params of rows) statement.execute(params)
      return
    case 'batch':
      db.executeBatch([{ query: INSERT_SQL, params: rows }])
      return
    case 'asyncSequential':
      return runSequentialAsync(db, rows)
    case 'asyncQueued':
      return runQueuedAsync(db, rows)
    case 'transaction':
      return runTransaction(db, rows)
    case 'batchAsync':
      return db
        .executeBatchAsync([{ query: INSERT_SQL, params: rows }])
        .then(() => undefined)
  }
}

async function runSequentialAsync(
  db: NitroSQLiteConnection,
  rows: SQLiteQueryParams[],
): Promise<void> {
  for (const params of rows) await db.executeAsync(INSERT_SQL, params)
}

async function runQueuedAsync(
  db: NitroSQLiteConnection,
  rows: SQLiteQueryParams[],
): Promise<void> {
  await Promise.all(rows.map((params) => db.executeAsync(INSERT_SQL, params)))
}

async function runTransaction(
  db: NitroSQLiteConnection,
  rows: SQLiteQueryParams[],
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const params of rows) await tx.executeAsync(INSERT_SQL, params)
  })
}
