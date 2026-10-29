import { NitroSQLite } from 'react-native-nitro-sqlite'
import type {
  NativeQueryResult,
  SQLiteQueryParams,
} from 'react-native-nitro-sqlite'
import { describe, it } from '@tests/TestApi'
import { TEST_DB_NAME, testDb } from '@tests/db'
import { expect } from '@tests/unit/common'

export default function registerQueryResultUnitTests() {
  for (const { name, execute } of queryExecutors) {
    for (const { name: shape, rowCount } of resultShapes) {
      describe(`${name}, ${shape}`, () => {
        it('preserves escaped text, binary values, and exact numbers', async () => {
          const text = `${String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i))}"\\é中😀\u2028\u2029`
          const bytes = [0, 34, 92, 127, 128, 255]
          const result = await execute(
            selectRows(
              `? AS text, ? AS payload, zeroblob(0) AS empty,
              ? AS tiny, ? AS huge, ? AS precise, ? AS negative_zero,
              ? AS positive_infinity, ? AS negative_infinity, ? AS missing,
              12345.0 AS whole_real, -7.0 AS negative_whole_real,
              CAST(9007199254740994 AS REAL) AS large_whole_real,
              ? AS large_fraction`,
              rowCount,
            ),
            [
              text,
              new Uint8Array(bytes).buffer,
              Number.MIN_VALUE,
              Number.MAX_VALUE,
              1.0000000000000002,
              -0,
              Infinity,
              -Infinity,
              undefined,
              4503599627370495.5,
            ],
          )
          expect(result.results).toHaveLength(rowCount)
          for (const row of result.results) {
            expect(row.text).toBe(text)
            expect(row.payload).toBeInstanceOf(ArrayBuffer)
            if (!(row.payload instanceof ArrayBuffer)) {
              throw new Error('Expected a binary result')
            }
            expect(Array.from(new Uint8Array(row.payload))).toEqual(bytes)
            expect(row.empty).toBeInstanceOf(ArrayBuffer)
            if (!(row.empty instanceof ArrayBuffer)) {
              throw new Error('Expected an empty binary result')
            }
            expect(row.empty.byteLength).toBe(0)
            expect(row.tiny).toBe(Number.MIN_VALUE)
            expect(row.huge).toBe(Number.MAX_VALUE)
            expect(row.precise).toBe(1.0000000000000002)
            expect(row.negative_zero).toBe(0)
            expect(row.positive_infinity).toBe(Infinity)
            expect(row.negative_infinity).toBe(-Infinity)
            expect(row.missing).toBe(null)
            expect(row.whole_real).toBe(12345)
            expect(row.negative_whole_real).toBe(-7)
            expect(row.large_whole_real).toBe(9007199254740994)
            expect(row.large_fraction).toBe(4503599627370495.5)
          }
        })

        it('uses the last duplicate column even when it replaces a native value', async () => {
          const { results } = await execute(
            selectRows(
              `x'01' AS first, 7 AS first,
              9e999 AS second, 'last' AS second,
              3 AS third, x'ff00' AS third,
              4 AS fourth, -9e999 AS fourth,
              x'02' AS fifth, NULL AS fifth`,
              rowCount,
            ),
          )
          expect(results).toHaveLength(rowCount)
          for (const row of results) {
            expect(row.first).toBe(7)
            expect(row.second).toBe('last')
            expect(row.third).toBeInstanceOf(ArrayBuffer)
            if (!(row.third instanceof ArrayBuffer)) {
              throw new Error('Expected the last binary column')
            }
            expect(Array.from(new Uint8Array(row.third))).toEqual([255, 0])
            expect(row.fourth).toBe(-Infinity)
            expect(row.fifth).toBe(null)
            expect(Object.keys(row)).toEqual([
              'first',
              'second',
              'third',
              'fourth',
              'fifth',
            ])
          }
        })

        it('keeps SQLite integers as JavaScript numbers at the precision limits', async () => {
          const { results } = await execute(
            selectRows(
              `9007199254740993 AS positive, -9007199254740993 AS negative,
              9223372036854775807 AS maximum, -9223372036854775808 AS minimum`,
              rowCount,
            ),
          )
          expect(results).toHaveLength(rowCount)
          for (const row of results) {
            expect(row).toEqual({
              positive: Number('9007199254740993'),
              negative: Number('-9007199254740993'),
              maximum: Number('9223372036854775807'),
              minimum: Number('-9223372036854775808'),
            })
          }
        })

        it('decodes malformed UTF-8 text without losing the rest of the result', async () => {
          const { results } = await execute(
            selectRows(
              "x'ff0022' AS payload, 9e999 AS infinite, CAST(x'ff' AS TEXT) AS invalid, 'after' AS valid",
              rowCount,
            ),
          )
          expect(results).toHaveLength(rowCount)
          for (const row of results) {
            expect(row.invalid).toBeTypeOf('string')
            expect(row.valid).toBe('after')
            expect(row.infinite).toBe(Infinity)
            if (!(row.payload instanceof ArrayBuffer)) {
              throw new Error(
                'Expected the binary column before malformed text',
              )
            }
            expect(Array.from(new Uint8Array(row.payload))).toEqual([
              255, 0, 34,
            ])
          }
        })
      })
    }
  }

  it('returns an empty array for statements without rows', async () => {
    for (const { execute } of queryExecutors) {
      expect((await execute('SELECT 1 AS value WHERE 0')).results).toEqual([])
    }
  })

  it('restores binary and infinite values across asynchronous batch boundaries', async () => {
    const result = await testDb.executeAsync(`
      WITH RECURSIVE counter(id) AS (
        SELECT 1 UNION ALL SELECT id + 1 FROM counter WHERE id < 1000
      )
      SELECT id, x'ff00225c' AS payload,
        CASE WHEN id % 2 = 0 THEN 9e999 ELSE -9e999 END AS infinite,
        CASE WHEN id = 513 THEN CAST(x'ff' AS TEXT)
          WHEN id % 3 = 0 THEN NULL ELSE 'é中😀' END AS text
      FROM counter ORDER BY id
    `)
    expect(result.rowBatchCount).toBe(3)
    expect(result.rows.length).toBe(1000)
    for (let index = 0; index < 1000; index++) {
      const row = result.rows.item(index)
      expect(row?.id).toBe(index + 1)
      expect(row?.payload).toBeInstanceOf(ArrayBuffer)
      if (!(row?.payload instanceof ArrayBuffer)) {
        throw new Error(`Expected binary data in row ${index + 1}`)
      }
      expect(Array.from(new Uint8Array(row.payload))).toEqual([255, 0, 34, 92])
      expect(row.infinite).toBe((index + 1) % 2 === 0 ? Infinity : -Infinity)
      if (index === 512) expect(row.text).toBeTypeOf('string')
      else expect(row.text).toBe((index + 1) % 3 === 0 ? null : 'é中😀')
    }
  })
}

// The native side converts results with few cells directly and encodes larger ones as JSON, so cover both.
const resultShapes = [
  { name: 'one row', rowCount: 1 },
  { name: 'many rows', rowCount: 40 },
]

function selectRows(columns: string, rowCount: number): string {
  if (rowCount === 1) return `SELECT ${columns}`
  return `WITH RECURSIVE counter(n) AS (
    SELECT 1 UNION ALL SELECT n + 1 FROM counter WHERE n < ${rowCount}
  ) SELECT ${columns} FROM counter`
}

const queryExecutors: {
  name: string
  execute(
    query: string,
    params?: SQLiteQueryParams,
  ): NativeQueryResult | Promise<NativeQueryResult>
}[] = [
  {
    name: 'execute',
    execute: (query, params) => testDb.execute(query, params),
  },
  {
    name: 'executeAsync',
    execute: (query, params) => testDb.executeAsync(query, params),
  },
  {
    name: 'prepared execute',
    execute: (query, params) => executePrepared(query, params, false),
  },
  {
    name: 'prepared executeAsync',
    execute: (query, params) => executePrepared(query, params, true),
  },
  {
    name: 'native execute',
    execute: (query, params) =>
      NitroSQLite.native.execute(TEST_DB_NAME, query, params),
  },
  {
    name: 'native executeAsync',
    execute: (query, params) =>
      NitroSQLite.native.executeAsync(TEST_DB_NAME, query, params),
  },
]

async function executePrepared(
  query: string,
  params: SQLiteQueryParams | undefined,
  asynchronous: boolean,
): Promise<NativeQueryResult> {
  const statement = testDb.prepare(query)
  try {
    return asynchronous
      ? await statement.executeAsync(params)
      : statement.execute(params)
  } finally {
    statement.finalize()
  }
}
