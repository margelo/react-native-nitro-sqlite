import { open, type NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import type { SQLiteQueryParams } from 'react-native-nitro-sqlite'
import type { BenchmarkCase, BenchmarkFixture } from './runner'
import { assertBenchmark, disposeBenchmarkDatabase } from './database'

const ROW_COUNT = 1000
const WORK_COUNT = 100
const BASE_SUM = (ROW_COUNT * (ROW_COUNT - 1)) / 2

export const mixedCase: BenchmarkCase = {
  id: 'mixed-wal',
  label: 'WAL · 100 writes + 100 reads on separate connections',
  setup: setupMixedCase,
}

async function setupMixedCase(): Promise<BenchmarkFixture> {
  const writer = open({ name: 'benchmark_mixed' })
  let reader: NitroSQLiteConnection | undefined

  try {
    const mode = writer
      .execute<{ journal_mode: string }>('PRAGMA journal_mode=WAL')
      .rows.item(0)?.journal_mode
    assertBenchmark(mode?.toLowerCase() === 'wal', 'WAL mode unavailable')
    writer.execute('DROP TABLE IF EXISTS Bench')
    writer.execute(
      'CREATE TABLE Bench (id INTEGER PRIMARY KEY, value INTEGER NOT NULL) STRICT',
    )
    const seed: SQLiteQueryParams[] = Array.from(
      { length: ROW_COUNT },
      (_, id) => [id, id],
    )
    await writer.executeBatchAsync([
      { query: 'INSERT INTO Bench VALUES (?, ?)', params: seed },
    ])
    reader = open({
      name: 'benchmark_mixed',
      connection: 'independent',
      readOnly: true,
    })
    const readConnection = reader
    const updates: SQLiteQueryParams[] = Array.from(
      { length: WORK_COUNT },
      (_, id) => [id],
    )
    let completedReads = 0

    return {
      database: writer,
      reset: () => {
        writer.execute('UPDATE Bench SET value = id')
      },
      run: async () => {
        completedReads = 0
        const readLatencies: number[] = []
        const writeStart = performance.now()
        const write = writer
          .executeBatchAsync([
            {
              query: 'UPDATE Bench SET value = value + 1 WHERE id = ?',
              params: updates,
            },
          ])
          .then(() => performance.now() - writeStart)
        const reads = Array.from({ length: WORK_COUNT }, async (_, id) => {
          const start = performance.now()
          const row = (
            await readConnection.executeAsync<{ id: number; value: number }>(
              'SELECT id, value FROM Bench WHERE id = ?',
              [id],
            )
          ).rows.item(0)
          readLatencies.push(performance.now() - start)
          assertBenchmark(row?.id === id, `Mixed read missed row ${id}`)
          assertBenchmark(
            row.value === id || row.value === id + 1,
            `Mixed read returned wrong value for ${id}`,
          )
          completedReads++
        })
        const [writeMs] = await Promise.all([write, Promise.all(reads)])
        return { writeMs, readLatencyP95Ms: percentile95(readLatencies) }
      },
      verify: () => {
        const row = writer
          .execute<{
            count: number
            total: number
          }>('SELECT COUNT(*) AS count, SUM(value) AS total FROM Bench')
          .rows.item(0)
        assertBenchmark(completedReads === WORK_COUNT, 'Missing mixed reads')
        assertBenchmark(row?.count === ROW_COUNT, 'Wrong mixed row count')
        assertBenchmark(row.total === BASE_SUM + WORK_COUNT, 'Wrong mixed sum')
      },
      dispose: () => {
        readConnection.close()
        disposeBenchmarkDatabase(writer)
      },
    }
  } catch (error) {
    reader?.close()
    disposeBenchmarkDatabase(writer)
    throw error
  }
}

function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0
}
