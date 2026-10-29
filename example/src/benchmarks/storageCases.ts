import type { SQLiteQueryParams } from 'react-native-nitro-sqlite'
import type { BenchmarkCase, BenchmarkFixture } from './runner'
import {
  assertBenchmark,
  createAppDatabase,
  disposeBenchmarkDatabase,
} from './database'

const KV_KEYS = 500
const KV_OPERATIONS = 1000
const CACHE_ENTRIES = 200
const CACHE_PRODUCTS = 20
const THUMBNAILS = 120
const THUMBNAIL_BYTES = 32 * 1024
const ALBUMS = 6
const START_TIME = Date.UTC(2026, 0, 1)

const KV_SET =
  'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'
const KV_GET = 'SELECT value FROM kv WHERE key = ?'
const CACHE_PERSIST =
  'INSERT INTO query_cache (key, data, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
const THUMBNAIL_INSERT = 'INSERT INTO thumbnails VALUES (?, ?, ?, ?, ?)'
const ALBUM_QUERY =
  'SELECT id, width, height, data FROM thumbnails WHERE album_id = ? ORDER BY id'

type CacheRow = { key: string; data: string }
type ThumbnailRow = {
  id: number
  width: number
  height: number
  data: ArrayBuffer
}

export const storageCases: BenchmarkCase[] = [
  {
    id: 'storage-kv',
    label: 'Key-value · 900 getItem + 100 setItem',
    setup: setupKeyValue,
  },
  {
    id: 'storage-response-cache',
    label: 'Response cache · persist + restore 200 × 9 KB JSON',
    setup: setupResponseCache,
  },
  {
    id: 'storage-thumbnails',
    label: 'Thumbnail cache · write + read 120 × 32 KB BLOBs',
    setup: setupThumbnails,
  },
]

// Synchronous storage like an AsyncStorage or MMKV replacement, with JSON values.
function setupKeyValue(): BenchmarkFixture {
  const db = createAppDatabase('benchmark_kv', [
    'CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
  ])
  try {
    const seed = Array.from({ length: KV_KEYS }, (_, i) => [
      kvKey(i),
      kvValue(i, 0),
    ])
    db.executeBatch([{ query: KV_SET, params: seed }])
    const operations = Array.from({ length: KV_OPERATIONS }, (_, i) => {
      const index = (i * 37) % KV_KEYS
      return {
        key: kvKey(index),
        value: i % 10 === 9 ? kvValue(index, i) : undefined,
      }
    })
    const written = new Set(
      operations.filter((op) => op.value != null).map((op) => op.key),
    )
    const restore = seed.filter(([key]) => written.has(key as string))
    const expected = expectedKeyValueChecksum(seed, operations)
    let checksum = 0

    return {
      database: db,
      reset: () => {
        db.executeBatch([{ query: KV_SET, params: restore }])
      },
      run: () => {
        checksum = 0
        for (const { key, value } of operations) {
          if (value != null) {
            db.execute(KV_SET, [key, value])
            continue
          }
          const stored = db
            .execute<{ value: string }>(KV_GET, [key])
            .rows.item(0)?.value
          assertBenchmark(stored != null, `Missing key ${key}`)
          checksum += (JSON.parse(stored) as { version: number }).version + 1
        }
      },
      verify: () =>
        assertBenchmark(checksum === expected, 'Wrong key-value checksum'),
      dispose: () => disposeBenchmarkDatabase(db),
    }
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

// Per-query persistence of API responses, as query cache persisters do,
// and the restore that parses every response at the next launch.
function setupResponseCache(): BenchmarkFixture {
  const db = createAppDatabase('benchmark_response_cache', [
    'CREATE TABLE query_cache (key TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL) STRICT',
  ])
  try {
    const entries: SQLiteQueryParams[] = Array.from(
      { length: CACHE_ENTRIES },
      (_, page) => [
        `["products",{"page":${page}}]`,
        JSON.stringify(productPage(page)),
        START_TIME + page,
      ],
    )
    const originals = new Map(entries.map(([key, data]) => [key, data]))
    let rows: CacheRow[] = []
    let products = 0

    return {
      database: db,
      reset: () => {
        db.execute('DELETE FROM query_cache')
      },
      run: async () => {
        const persistStart = performance.now()
        await db.executeBatchAsync([{ query: CACHE_PERSIST, params: entries }])
        const persistMs = performance.now() - persistStart

        const restoreStart = performance.now()
        rows = (
          await db.executeAsync<CacheRow>('SELECT key, data FROM query_cache')
        ).rows._array
        products = 0
        for (const row of rows) {
          products += (JSON.parse(row.data) as { items: unknown[] }).items
            .length
        }
        return { persistMs, restoreMs: performance.now() - restoreStart }
      },
      verify: () => {
        assertBenchmark(rows.length === CACHE_ENTRIES, 'Wrong cached rows')
        assertBenchmark(
          products === CACHE_ENTRIES * CACHE_PRODUCTS,
          'Wrong cached products',
        )
        for (const row of rows) {
          assertBenchmark(
            originals.get(row.key) === row.data,
            `Wrong cached response ${row.key}`,
          )
        }
      },
      dispose: () => disposeBenchmarkDatabase(db),
    }
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

// Image thumbnails stored as BLOBs and read back one album at a time.
function setupThumbnails(): BenchmarkFixture {
  const db = createAppDatabase('benchmark_thumbnails', [
    'CREATE TABLE thumbnails (id INTEGER PRIMARY KEY, album_id INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, data BLOB NOT NULL) STRICT',
    'CREATE INDEX thumbnails_by_album ON thumbnails (album_id)',
  ])
  try {
    const thumbnails: SQLiteQueryParams[] = Array.from(
      { length: THUMBNAILS },
      (_, id) => [
        id,
        id % ALBUMS,
        256,
        256,
        new Uint8Array(THUMBNAIL_BYTES).fill(id % 256).buffer,
      ],
    )
    let albums: ThumbnailRow[][] = []
    let bytes = 0

    return {
      database: db,
      reset: () => {
        db.execute('DELETE FROM thumbnails')
      },
      run: async () => {
        const writeStart = performance.now()
        await db.executeBatchAsync([
          { query: THUMBNAIL_INSERT, params: thumbnails },
        ])
        const writeMs = performance.now() - writeStart

        const readStart = performance.now()
        albums = []
        bytes = 0
        for (let album = 0; album < ALBUMS; album++) {
          const rows = (
            await db.executeAsync<ThumbnailRow>(ALBUM_QUERY, [album])
          ).rows._array
          for (const row of rows) bytes += row.data.byteLength
          albums.push(rows)
        }
        return { writeMs, readMs: performance.now() - readStart }
      },
      verify: () => {
        const rows = albums.flat()
        assertBenchmark(rows.length === THUMBNAILS, 'Wrong thumbnail count')
        assertBenchmark(
          bytes === THUMBNAILS * THUMBNAIL_BYTES,
          'Wrong thumbnail bytes',
        )
        for (const row of rows) {
          const data = new Uint8Array(row.data)
          assertBenchmark(
            data[0] === row.id % 256 && data[THUMBNAIL_BYTES - 1] === data[0],
            `Wrong thumbnail ${row.id}`,
          )
        }
      },
      dispose: () => disposeBenchmarkDatabase(db),
    }
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

function expectedKeyValueChecksum(
  seed: SQLiteQueryParams[],
  operations: { key: string; value?: string }[],
): number {
  const values = new Map(seed.map(([key, value]) => [key, value as string]))
  let checksum = 0
  for (const { key, value } of operations) {
    if (value != null) {
      values.set(key, value)
      continue
    }
    const stored = values.get(key)
    if (stored != null) {
      checksum += (JSON.parse(stored) as { version: number }).version + 1
    }
  }
  return checksum
}

function kvKey(index: number): string {
  const prefixes = ['settings', 'user', 'feed', 'draft']
  return `${prefixes[index % prefixes.length]}:${index}`
}

function kvValue(index: number, version: number): string {
  return JSON.stringify({
    version,
    id: index,
    updatedAt: START_TIME + index * 1000 + version,
    flags: { pinned: index % 3 === 0, muted: index % 5 === 0 },
    tags: Array.from({ length: 1 + (index % 8) }, (_, k) => `tag-${k}`),
    note: 'Grüße aus Wien 👋 '.repeat(1 + (index % 6)),
  })
}

function productPage(page: number) {
  return {
    items: Array.from({ length: CACHE_PRODUCTS }, (_, i) => {
      const id = page * CACHE_PRODUCTS + i
      return {
        id,
        sku: `SKU-${String(id).padStart(6, '0')}`,
        title: `Wireless headphones "Pro ${id % 9}" – edition ${id % 4}`,
        price: { amount: 1999 + (id % 200) * 100, currency: 'EUR' },
        rating: 3 + (id % 20) / 10,
        reviewCount: (id * 37) % 5000,
        tags: ['audio', 'bluetooth', id % 3 === 0 ? 'sale' : 'new'],
        seller: { id: id % 97, name: 'Müller Elektronik', verified: true },
        imageUrl: `https://cdn.example.com/products/${id}/main.webp`,
        description:
          'Kabellose Kopfhörer mit Geräuschunterdrückung, 30 Stunden Akku und Schnellladen über USB-C. Überall guter Klang 🎧',
        inStock: id % 5 !== 0,
      }
    }),
    nextCursor: `page-${page + 1}`,
  }
}
