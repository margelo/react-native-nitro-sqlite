/**
 * Harness spec for sqlite-vec vector search.
 *
 * sqlite-vec is exposed entirely through SQL (the `vec0` virtual table + a set
 * of `vec_*` scalar / table functions), so these tests drive the existing
 * `open()` / `execute()` API — no new JS surface is required.
 *
 * THIS IS A TEST-FIRST (TDD) SPEC. Until sqlite-vec is statically linked and
 * registered via `sqlite3_auto_extension(sqlite3_vec_init)`, every test here
 * fails with "no such function: vec_version" / "no such module: vec0". That is
 * the expected RED baseline; the suite goes green once the extension is built
 * into the native library.
 *
 * Coverage:
 *  - extension availability (vec_version / vec_debug)
 *  - constructors & introspection (vec_f32/int8/bit, vec_length/type/to_json)
 *  - vector math (vec_add/sub/normalize/slice, vec_each)
 *  - distance functions (L2 / L1 / cosine / hamming)
 *  - quantization (vec_quantize_binary)
 *  - vec0 KNN float32 (both `AND k = N` and `ORDER BY distance LIMIT N` forms,
 *    plus bound `?` query vectors)
 *  - vec0 distance_metric=cosine
 *  - vec0 metadata columns + filtering (=, >, BETWEEN)
 *  - vec0 auxiliary (+) columns
 *  - vec0 partition key columns
 *  - vec0 int8 and bit vectors
 *  - vec0 UPDATE / DELETE
 *  - error cases (dimension mismatch, missing k/limit)
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from 'react-native-harness'
import { open, NitroSQLiteError } from 'react-native-nitro-sqlite'
import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'

type Param = string | number | null
type Row = Record<string, unknown>

const DB_NAME = 'harness_vec'
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
}

function rows(sql: string, params?: Param[]): Row[] {
  return (db.execute(sql, params).rows?._array ?? []) as Row[]
}

function one(sql: string, params?: Param[]): Row | undefined {
  return rows(sql, params)[0]
}

function val<T = unknown>(sql: string, params?: Param[]): T {
  return one(sql, params)?.value as T
}

describe('sqlite-vec - availability', () => {
  beforeEach(resetDb)
  afterAll(() => closeQuietly(db))

  it('vec_version() returns a version string', () => {
    const version = val<string>('SELECT vec_version() AS value')
    expect(typeof version).toBe('string')
    expect(version.length).toBeGreaterThan(0)
    expect(version.startsWith('v')).toBe(true)
  })

  it('vec_debug() returns a non-empty build string', () => {
    const debug = val<string>('SELECT vec_debug() AS value')
    expect(typeof debug).toBe('string')
    expect(debug.length).toBeGreaterThan(0)
  })
})

describe('sqlite-vec - constructors & introspection', () => {
  beforeEach(resetDb)
  afterAll(() => closeQuietly(db))

  it('vec_length() reports the dimension count', () => {
    expect(val<number>("SELECT vec_length('[0.1, 0.2, 0.3]') AS value")).toBe(3)
  })

  it('vec_type() of a JSON array is float32', () => {
    expect(val<string>("SELECT vec_type('[0.1, 0.2]') AS value")).toBe(
      'float32',
    )
  })

  it('vec_type() of vec_int8 is int8', () => {
    expect(
      val<string>("SELECT vec_type(vec_int8('[1, 2, 3, 4]')) AS value"),
    ).toBe('int8')
  })

  it('vec_type() and vec_length() of a bit vector', () => {
    expect(val<string>("SELECT vec_type(vec_bit(X'F0')) AS value")).toBe('bit')
    expect(val<number>("SELECT vec_length(vec_bit(X'F0')) AS value")).toBe(8)
  })

  it('vec_to_json() round-trips a float32 vector', () => {
    expect(val<string>("SELECT vec_to_json(vec_f32('[1, 2, 3]')) AS value")).toBe(
      '[1.000000,2.000000,3.000000]',
    )
  })

  it('vec_to_json() of an int8 vector has no decimals', () => {
    expect(
      val<string>("SELECT vec_to_json(vec_int8('[1, 2, 3, 4]')) AS value"),
    ).toBe('[1,2,3,4]')
  })
})

describe('sqlite-vec - vector math', () => {
  beforeEach(resetDb)
  afterAll(() => closeQuietly(db))

  it('vec_add() sums element-wise', () => {
    expect(
      val<string>(
        "SELECT vec_to_json(vec_add('[1, 2, 3]', '[4, 5, 6]')) AS value",
      ),
    ).toBe('[5.000000,7.000000,9.000000]')
  })

  it('vec_sub() subtracts element-wise', () => {
    expect(
      val<string>(
        "SELECT vec_to_json(vec_sub('[4, 5, 6]', '[1, 2, 3]')) AS value",
      ),
    ).toBe('[3.000000,3.000000,3.000000]')
  })

  it('vec_slice() extracts a subvector', () => {
    expect(
      val<string>("SELECT vec_to_json(vec_slice('[1, 2, 3, 4]', 0, 2)) AS value"),
    ).toBe('[1.000000,2.000000]')
  })

  it('vec_normalize() yields a unit vector', () => {
    const json = val<string>(
      "SELECT vec_to_json(vec_normalize('[2, 3, 1, -4]')) AS value",
    )
    const parsed = JSON.parse(json) as number[]
    expect(parsed).toHaveLength(4)
    const magnitude = Math.sqrt(parsed.reduce((acc, x) => acc + x * x, 0))
    expect(magnitude).toBeCloseTo(1, 5)
    expect(parsed[0]).toBeCloseTo(0.365148, 4)
  })

  it('vec_each() enumerates elements as rows', () => {
    const values = rows(
      "SELECT value FROM vec_each('[1, 2, 3, 4]') ORDER BY rowid",
    ).map((r) => r.value as number)
    expect(values).toEqual([1, 2, 3, 4])
  })
})

describe('sqlite-vec - distance functions', () => {
  beforeEach(resetDb)
  afterAll(() => closeQuietly(db))

  it('vec_distance_l2() computes Euclidean distance', () => {
    expect(
      val<number>("SELECT vec_distance_l2('[1, 1]', '[2, 2]') AS value"),
    ).toBeCloseTo(Math.SQRT2, 4)
  })

  it('vec_distance_l1() computes Manhattan distance', () => {
    expect(
      val<number>("SELECT vec_distance_l1('[1, 1]', '[2, 2]') AS value"),
    ).toBeCloseTo(2, 4)
  })

  it('vec_distance_cosine() is ~0 for parallel vectors', () => {
    expect(
      val<number>("SELECT vec_distance_cosine('[1, 1]', '[2, 2]') AS value"),
    ).toBeCloseTo(0, 5)
  })

  it('vec_distance_cosine() is ~2 for opposite vectors', () => {
    expect(
      val<number>("SELECT vec_distance_cosine('[1, 0]', '[-1, 0]') AS value"),
    ).toBeCloseTo(2, 5)
  })

  it('vec_distance_hamming() counts differing bits', () => {
    expect(
      val<number>(
        "SELECT vec_distance_hamming(vec_bit(X'00'), vec_bit(X'FF')) AS value",
      ),
    ).toBe(8)
    expect(
      val<number>(
        "SELECT vec_distance_hamming(vec_bit(X'0F'), vec_bit(X'0F')) AS value",
      ),
    ).toBe(0)
  })
})

describe('sqlite-vec - quantization', () => {
  beforeEach(resetDb)
  afterAll(() => closeQuietly(db))

  it('vec_quantize_binary() packs signs into a bit vector', () => {
    expect(
      val<string>(
        "SELECT hex(vec_quantize_binary('[1, 2, 3, 4, -5, -6, -7, -8]')) AS value",
      ),
    ).toBe('0F')
  })

  it('vec_quantize_binary() output is a bit vector', () => {
    expect(
      val<string>(
        "SELECT vec_type(vec_quantize_binary('[1, 2, 3, 4, 5, 6, 7, 8]')) AS value",
      ),
    ).toBe('bit')
  })
})

describe('sqlite-vec - vec0 KNN (float32, default L2)', () => {
  beforeEach(() => {
    resetDb()
    db.execute('CREATE VIRTUAL TABLE vec_items USING vec0(embedding float[4]);')
    db.executeBatch([
      { query: 'INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)', params: [1, '[1, 1, 1, 1]'] },
      { query: 'INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)', params: [2, '[1, 1, 1, 2]'] },
      { query: 'INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)', params: [3, '[5, 5, 5, 5]'] },
      { query: 'INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)', params: [4, '[9, 9, 9, 9]'] },
    ])
  })
  afterAll(() => closeQuietly(db))

  it('returns the k nearest rows ordered by ascending distance ("AND k =")', () => {
    const result = rows(
      "SELECT rowid, distance FROM vec_items WHERE embedding MATCH '[1, 1, 1, 1]' AND k = 2 ORDER BY distance",
    )
    expect(result).toHaveLength(2)
    expect(result[0]?.rowid).toBe(1)
    expect(result[1]?.rowid).toBe(2)
    expect(result[0]?.distance as number).toBeCloseTo(0, 5)
    expect((result[1]?.distance as number) > (result[0]?.distance as number)).toBe(
      true,
    )
  })

  it('supports the "ORDER BY distance LIMIT N" form', () => {
    const result = rows(
      "SELECT rowid, distance FROM vec_items WHERE embedding MATCH '[1, 1, 1, 1]' ORDER BY distance LIMIT 3",
    )
    expect(result).toHaveLength(3)
    expect(result[0]?.rowid).toBe(1)
  })

  it('accepts a bound (?) query vector', () => {
    const result = rows(
      'SELECT rowid, distance FROM vec_items WHERE embedding MATCH ? AND k = 1 ORDER BY distance',
      ['[9, 9, 9, 9]'],
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.rowid).toBe(4)
    expect(result[0]?.distance as number).toBeCloseTo(0, 5)
  })
})

describe('sqlite-vec - vec0 distance_metric=cosine', () => {
  beforeEach(() => {
    resetDb()
    db.execute(
      'CREATE VIRTUAL TABLE vec_cos USING vec0(embedding float[4] distance_metric=cosine);',
    )
    db.executeBatch([
      { query: 'INSERT INTO vec_cos(rowid, embedding) VALUES (?, ?)', params: [1, '[1, 0, 0, 0]'] },
      { query: 'INSERT INTO vec_cos(rowid, embedding) VALUES (?, ?)', params: [2, '[0, 1, 0, 0]'] },
      { query: 'INSERT INTO vec_cos(rowid, embedding) VALUES (?, ?)', params: [3, '[2, 0, 0, 0]'] },
    ])
  })
  afterAll(() => closeQuietly(db))

  it('ranks same-direction vectors as nearest regardless of magnitude', () => {
    const result = rows(
      "SELECT rowid, distance FROM vec_cos WHERE embedding MATCH '[1, 0, 0, 0]' AND k = 3 ORDER BY distance",
    )
    expect(result).toHaveLength(3)
    const byRow = new Map(result.map((r) => [r.rowid, r.distance as number]))
    // rowids 1 and 3 point the same way as the query -> cosine distance ~0
    expect(byRow.get(1)).toBeCloseTo(0, 5)
    expect(byRow.get(3)).toBeCloseTo(0, 5)
    // rowid 2 is orthogonal -> cosine distance ~1
    expect(byRow.get(2)).toBeCloseTo(1, 5)
  })
})

describe('sqlite-vec - vec0 metadata columns + filtering', () => {
  beforeEach(() => {
    resetDb()
    db.execute(
      'CREATE VIRTUAL TABLE vec_docs USING vec0(id integer primary key, embedding float[2], genre text, rating float);',
    )
    db.executeBatch([
      { query: 'INSERT INTO vec_docs(id, embedding, genre, rating) VALUES (?, ?, ?, ?)', params: [1, '[1, 1]', 'scifi', 4.5] },
      { query: 'INSERT INTO vec_docs(id, embedding, genre, rating) VALUES (?, ?, ?, ?)', params: [2, '[2, 2]', 'horror', 3.0] },
      { query: 'INSERT INTO vec_docs(id, embedding, genre, rating) VALUES (?, ?, ?, ?)', params: [3, '[1, 2]', 'scifi', 4.8] },
    ])
  })
  afterAll(() => closeQuietly(db))

  it('filters KNN results by an equality metadata constraint', () => {
    const result = rows(
      "SELECT id, genre, distance FROM vec_docs WHERE embedding MATCH '[1, 1]' AND k = 5 AND genre = 'scifi'",
    )
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.genre === 'scifi')).toBe(true)
    expect(new Set(result.map((r) => r.id))).toEqual(new Set([1, 3]))
  })

  it('filters KNN results by a > comparison', () => {
    const result = rows(
      "SELECT id, rating, distance FROM vec_docs WHERE embedding MATCH '[1, 1]' AND k = 5 AND rating > 4.0",
    )
    expect(result).toHaveLength(2)
    expect(result.every((r) => (r.rating as number) > 4.0)).toBe(true)
  })

  it('filters KNN results by a BETWEEN range', () => {
    const result = rows(
      "SELECT id, rating, distance FROM vec_docs WHERE embedding MATCH '[1, 1]' AND k = 5 AND rating BETWEEN 4.0 AND 4.6",
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(1)
  })
})

describe('sqlite-vec - vec0 auxiliary (+) columns', () => {
  beforeEach(() => {
    resetDb()
    db.execute(
      'CREATE VIRTUAL TABLE vec_aux USING vec0(embedding float[2], +title text);',
    )
    db.executeBatch([
      { query: 'INSERT INTO vec_aux(rowid, embedding, title) VALUES (?, ?, ?)', params: [1, '[1, 1]', 'closest'] },
      { query: 'INSERT INTO vec_aux(rowid, embedding, title) VALUES (?, ?, ?)', params: [2, '[9, 9]', 'far'] },
    ])
  })
  afterAll(() => closeQuietly(db))

  it('returns auxiliary column data in KNN results without a join', () => {
    const result = rows(
      "SELECT rowid, title, distance FROM vec_aux WHERE embedding MATCH '[1, 1]' AND k = 1",
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('closest')
  })
})

describe('sqlite-vec - vec0 partition key columns', () => {
  beforeEach(() => {
    resetDb()
    db.execute(
      'CREATE VIRTUAL TABLE vec_parts USING vec0(user_id integer partition key, embedding float[2]);',
    )
    db.executeBatch([
      { query: 'INSERT INTO vec_parts(user_id, embedding) VALUES (?, ?)', params: [1, '[1, 1]'] },
      { query: 'INSERT INTO vec_parts(user_id, embedding) VALUES (?, ?)', params: [1, '[2, 2]'] },
      { query: 'INSERT INTO vec_parts(user_id, embedding) VALUES (?, ?)', params: [2, '[1, 1]'] },
    ])
  })
  afterAll(() => closeQuietly(db))

  it('restricts KNN to a single partition', () => {
    const result = rows(
      "SELECT user_id, distance FROM vec_parts WHERE embedding MATCH '[1, 1]' AND k = 5 AND user_id = 1",
    )
    expect(result).toHaveLength(2)
    expect(result.every((r) => r.user_id === 1)).toBe(true)
  })
})

describe('sqlite-vec - vec0 int8 vectors', () => {
  beforeEach(() => {
    resetDb()
    db.execute('CREATE VIRTUAL TABLE vec_i8 USING vec0(embedding int8[4]);')
    db.executeBatch([
      { query: 'INSERT INTO vec_i8(rowid, embedding) VALUES (?, ?)', params: [1, '[1, 2, 3, 4]'] },
      { query: 'INSERT INTO vec_i8(rowid, embedding) VALUES (?, ?)', params: [2, '[10, 20, 30, 40]'] },
    ])
  })
  afterAll(() => closeQuietly(db))

  it('runs KNN over int8 vectors', () => {
    const result = rows(
      "SELECT rowid, distance FROM vec_i8 WHERE embedding MATCH '[1, 2, 3, 4]' AND k = 1 ORDER BY distance",
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.rowid).toBe(1)
    expect(result[0]?.distance as number).toBeCloseTo(0, 5)
  })
})

describe('sqlite-vec - vec0 bit vectors', () => {
  beforeEach(() => {
    resetDb()
    db.execute(
      'CREATE VIRTUAL TABLE vec_bits USING vec0(embedding bit[8] distance_metric=hamming);',
    )
    db.execute("INSERT INTO vec_bits(rowid, embedding) VALUES (1, vec_bit(X'0F'));")
    db.execute("INSERT INTO vec_bits(rowid, embedding) VALUES (2, vec_bit(X'FF'));")
  })
  afterAll(() => closeQuietly(db))

  it('runs hamming KNN over bit vectors', () => {
    const result = rows(
      "SELECT rowid, distance FROM vec_bits WHERE embedding MATCH vec_bit(X'0F') AND k = 2 ORDER BY distance",
    )
    expect(result).toHaveLength(2)
    expect(result[0]?.rowid).toBe(1)
    expect(result[0]?.distance as number).toBe(0)
    // X'0F' vs X'FF' differ in the top 4 bits -> hamming distance 4
    expect(result[1]?.rowid).toBe(2)
    expect(result[1]?.distance as number).toBe(4)
  })
})

describe('sqlite-vec - vec0 UPDATE / DELETE', () => {
  beforeEach(() => {
    resetDb()
    db.execute('CREATE VIRTUAL TABLE vec_mut USING vec0(embedding float[4]);')
    db.executeBatch([
      { query: 'INSERT INTO vec_mut(rowid, embedding) VALUES (?, ?)', params: [1, '[1, 1, 1, 1]'] },
      { query: 'INSERT INTO vec_mut(rowid, embedding) VALUES (?, ?)', params: [2, '[5, 5, 5, 5]'] },
    ])
  })
  afterAll(() => closeQuietly(db))

  it('reflects an UPDATE to a vector in subsequent KNN results', () => {
    db.execute("UPDATE vec_mut SET embedding = '[9, 9, 9, 9]' WHERE rowid = 1")
    const result = rows(
      "SELECT rowid, distance FROM vec_mut WHERE embedding MATCH '[1, 1, 1, 1]' AND k = 1 ORDER BY distance",
    )
    // rowid 2 ([5,5,5,5]) is now nearer to the query than the moved rowid 1
    expect(result[0]?.rowid).toBe(2)
  })

  it('removes a row on DELETE', () => {
    db.execute('DELETE FROM vec_mut WHERE rowid = 1')
    const result = rows(
      "SELECT rowid, distance FROM vec_mut WHERE embedding MATCH '[1, 1, 1, 1]' AND k = 5 ORDER BY distance",
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.rowid).toBe(2)
  })
})

describe('sqlite-vec - error cases', () => {
  beforeEach(() => {
    resetDb()
    db.execute('CREATE VIRTUAL TABLE vec_err USING vec0(embedding float[4]);')
    db.execute("INSERT INTO vec_err(rowid, embedding) VALUES (1, '[1, 1, 1, 1]');")
  })
  afterAll(() => closeQuietly(db))

  it('rejects an INSERT with the wrong dimension count', () => {
    let threw = false
    try {
      db.execute("INSERT INTO vec_err(rowid, embedding) VALUES (2, '[1, 2, 3]')")
    } catch (e) {
      threw = true
      expect(e instanceof NitroSQLiteError).toBe(true)
    }
    expect(threw).toBe(true)
  })

  it('rejects a KNN query with neither k nor LIMIT', () => {
    let threw = false
    try {
      db.execute(
        "SELECT rowid, distance FROM vec_err WHERE embedding MATCH '[1, 1, 1, 1]'",
      )
    } catch (e) {
      threw = true
      expect(e instanceof NitroSQLiteError).toBe(true)
    }
    expect(threw).toBe(true)
  })
})
