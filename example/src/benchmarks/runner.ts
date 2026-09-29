import { Platform } from 'react-native'
import { open, type NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import { version } from '../../package.json'
import {
  getDeviceIdentifier,
  measureProcessMemory,
  type MemoryMeasurement,
} from './memory'

export interface BenchmarkFixture {
  database: NitroSQLiteConnection
  reset?(): void | Promise<void>
  run():
    | void
    | Promise<void>
    | Record<string, number>
    | Promise<Record<string, number>>
  verify(): void | Promise<void>
  dispose(): void | Promise<void>
}

export interface BenchmarkCase {
  id: string
  label: string
  measuredRuns?: number
  setup(): BenchmarkFixture | Promise<BenchmarkFixture>
}

export interface BenchmarkSample {
  elapsedMs: number
  metrics?: Record<string, number>
}

export interface SQLiteSettings {
  journalMode: string
  synchronous: number
}

export type BenchmarkResult =
  | {
      id: string
      label: string
      status: 'passed'
      sqliteSettings: SQLiteSettings
      samples: BenchmarkSample[]
      medianMs: number
      minMs: number
      maxMs: number
      jsTimerDelayMs: number | null
      memory: MemoryMeasurement
    }
  | {
      id: string
      label: string
      status: 'failed'
      sqliteSettings?: SQLiteSettings
      error: string
    }

export interface BenchmarkReport {
  createdAt: string
  environment: {
    appVersion: string
    buildLabel: string
    platform: string
    osVersion: string | number
    deviceModel: string
    jsEngine: string
    developmentBuild: boolean
    sqliteSourceId: string
    sqliteVersion: string
    compileOptions: string[]
  }
  warmupRuns: number
  defaultMeasuredRuns: number
  results: BenchmarkResult[]
}

const MEASURED_RUNS = 5
const COOL_DOWN_MS = 200
const JS_TIMER_INTERVAL_MS = 16

export async function runBenchmarkCases(
  cases: BenchmarkCase[],
  buildLabel: string,
  onProgress: (label: string, result?: BenchmarkResult) => void,
): Promise<BenchmarkReport> {
  const environment = await readEnvironment(buildLabel)
  const results: BenchmarkResult[] = []

  for (const benchmark of cases) {
    onProgress(benchmark.label)
    const result = await runCase(benchmark)
    results.push(result)
    onProgress(benchmark.label, result)
  }

  return {
    createdAt: new Date().toISOString(),
    environment,
    warmupRuns: 1,
    defaultMeasuredRuns: MEASURED_RUNS,
    results,
  }
}

async function runCase(benchmark: BenchmarkCase): Promise<BenchmarkResult> {
  let fixture: BenchmarkFixture | undefined
  const samples: BenchmarkSample[] = []
  const runs = benchmark.measuredRuns ?? MEASURED_RUNS
  let result: BenchmarkResult
  let sqliteSettings: SQLiteSettings | undefined

  try {
    fixture = await benchmark.setup()
    sqliteSettings = readSQLiteSettings(fixture.database)

    for (let run = 0; run <= runs; run++) {
      await fixture.reset?.()
      const sample = await measureElapsed(fixture.run)
      await fixture.verify()
      if (run > 0) samples.push(sample)
      if (run < runs) await sleep(COOL_DOWN_MS)
    }

    await fixture.reset?.()
    const jsTimerDelayMs = await measureJsTimerDelay(fixture.run)
    await fixture.verify()

    await fixture.reset?.()
    const memory = await measureProcessMemory(fixture.run)
    if (memory.status === 'measured') await fixture.verify()

    const elapsed = samples.map((sample) => sample.elapsedMs)
    result = {
      id: benchmark.id,
      label: benchmark.label,
      status: 'passed',
      sqliteSettings,
      samples,
      medianMs: percentile(elapsed, 0.5),
      minMs: Math.min(...elapsed),
      maxMs: Math.max(...elapsed),
      jsTimerDelayMs,
      memory,
    }
  } catch (error) {
    result = {
      id: benchmark.id,
      label: benchmark.label,
      status: 'failed',
      sqliteSettings,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  try {
    await fixture?.dispose()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    result = {
      id: benchmark.id,
      label: benchmark.label,
      status: 'failed',
      sqliteSettings,
      error:
        result.status === 'failed'
          ? `${result.error}; cleanup failed: ${message}`
          : `Cleanup failed: ${message}`,
    }
  }

  return result
}

async function measureElapsed(
  run: BenchmarkFixture['run'],
): Promise<BenchmarkSample> {
  const start = performance.now()
  const metrics = await run()
  return {
    elapsedMs: performance.now() - start,
    ...(metrics == null ? {} : { metrics }),
  }
}

async function measureJsTimerDelay(
  run: BenchmarkFixture['run'],
): Promise<number | null> {
  let lastTick = performance.now()
  let maxDelay = 0
  let ticks = 0
  const timer = setInterval(() => {
    const now = performance.now()
    maxDelay = Math.max(maxDelay, now - lastTick - JS_TIMER_INTERVAL_MS)
    lastTick = now
    ticks++
  }, JS_TIMER_INTERVAL_MS)

  try {
    await run()
    // Let a timer tick after a synchronous operation blocks JS.
    await sleep(JS_TIMER_INTERVAL_MS)
    return ticks > 0 ? maxDelay : null
  } finally {
    clearInterval(timer)
  }
}

async function readEnvironment(
  buildLabel: string,
): Promise<BenchmarkReport['environment']> {
  const db = open({ name: 'benchmark_metadata' })
  try {
    const source = db
      .execute<{ value: string }>('SELECT sqlite_source_id() AS value')
      .rows.item(0)
    const sqliteVersion = db
      .execute<{ value: string }>('SELECT sqlite_version() AS value')
      .rows.item(0)
    const compileOptions = db
      .execute<{ compile_options: string }>('PRAGMA compile_options')
      .rows._array.map((row) => row.compile_options)
    const model =
      'Model' in Platform.constants ? Platform.constants.Model : undefined

    if (!source || !sqliteVersion) {
      throw new Error('Could not read SQLite build metadata')
    }

    return {
      appVersion: version,
      buildLabel,
      platform: Platform.OS,
      osVersion: Platform.Version,
      deviceModel:
        (await getDeviceIdentifier()) ??
        (typeof model === 'string' ? model : 'unknown'),
      jsEngine: 'HermesInternal' in globalThis ? 'Hermes' : 'other',
      developmentBuild: __DEV__,
      sqliteSourceId: source.value,
      sqliteVersion: sqliteVersion.value,
      compileOptions,
    }
  } finally {
    db.close()
    db.delete()
  }
}

function readSQLiteSettings(db: NitroSQLiteConnection): SQLiteSettings {
  const journal = db
    .execute<{ journal_mode: string }>('PRAGMA journal_mode')
    .rows.item(0)
  const sync = db
    .execute<{ synchronous: number }>('PRAGMA synchronous')
    .rows.item(0)
  if (!journal || !sync) throw new Error('Could not read SQLite settings')
  return { journalMode: journal.journal_mode, synchronous: sync.synchronous }
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(fraction * sorted.length) - 1
  return sorted[Math.max(0, index)] ?? 0
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
