# react-native-nitro-sqlite-vec

Vector search for [`react-native-nitro-sqlite`](https://github.com/margelo/react-native-nitro-sqlite), powered by [`sqlite-vec`](https://github.com/asg017/sqlite-vec).

## How it works

This package ships the native `sqlite-vec` amalgamation (v0.1.9). When enabled, its
sources are compiled **into the core `react-native-nitro-sqlite` library's single
sqlite3 build** and registered with `sqlite3_auto_extension`. That means:

- **One sqlite3.** No second SQLite copy, no version skew.
- **Statically linked.** No runtime extension loading (`sqlite3_load_extension`), no
  separate `.so`/`.dylib`, no `dlopen` — faster than the runtime-load approach used by
  `expo-sqlite`.
- **No new query API.** Vector search runs through the core's existing `execute()`
  using `vec0` virtual tables and `vec_*` SQL functions.

## Install

```sh
bun add react-native-nitro-sqlite-vec
# requires react-native-nitro-sqlite >= 9.0.0
```

Then enable the native build (opt-in, default off):

- **Android** — in `android/gradle.properties`:
  ```properties
  nitroSqliteVec=true
  ```
- **iOS** — _(coming next)_ set the `NITRO_SQLITE_VEC` flag and `pod install`.

Rebuild the app after enabling.

## Usage

Everything works through the core connection's `execute()`:

```ts
import { open } from 'react-native-nitro-sqlite'

const db = open({ name: 'app' })

db.execute('CREATE VIRTUAL TABLE items USING vec0(embedding float[4])')
db.execute('INSERT INTO items(rowid, embedding) VALUES (?, ?)', [1, '[0.1, 0.2, 0.3, 0.4]'])

const { rows } = db.execute(
  'SELECT rowid, distance FROM items WHERE embedding MATCH ? ORDER BY distance LIMIT 5',
  ['[0.1, 0.2, 0.3, 0.4]'],
)
```

Optional typed helpers:

```ts
import { vecVersion, createVectorTable, knnSearch } from 'react-native-nitro-sqlite-vec'

vecVersion(db) // "v0.1.9"
createVectorTable(db, 'items', { dimensions: 4, distanceMetric: 'cosine' })
const matches = knnSearch(db, 'items', [0.1, 0.2, 0.3, 0.4], 5)
```

See the [`sqlite-vec` docs](https://alexgarcia.xyz/sqlite-vec/) for the full SQL surface
(metadata filtering, partition keys, auxiliary columns, int8/bit vectors, quantization).

## Notes & gotchas

- **`rowid` / primary-key / partition-key** columns require integers. JavaScript only
  has `number`; the core binds whole-number values as SQLite INTEGER, so these work.
- **`FLOAT` metadata columns** require a real value. A whole number (e.g. `3`) binds as
  INTEGER and `vec0` will reject it — store `3.0` as a fractional value, or `CAST(? AS REAL)`.
- **`int8` / `bit`** vector columns need typed vectors: use `vec_int8('[...]')` /
  `vec_bit(X'..')` (a bare JSON array is parsed as float32).
- `distance_metric` accepts `L2` (default), `cosine`, `L1`. Bit vectors use hamming
  distance implicitly.

## Benchmarks

Vector-only benchmark vs **expo-sqlite** (which loads sqlite-vec as a *runtime* extension),
both installed in the **same Expo app**, on the **same device**, over the **same seeded
data**. Workload: 1000 inserts + 1000 KNN queries (k=10) on 128-dim float32 vectors, 5 runs.

**Android — Samsung Galaxy M14 (SM-E146B), a low-end device, debug build, avg of 5 runs.**
**Correctness:** for 100 queries/run, this library and expo-sqlite returned **bit-identical**
KNN results — 100/100 match, max distance diff 0, every run.

| Operation | this (static) | expo-sqlite (runtime-loaded) | speedup |
|---|---:|---:|---:|
| **scalar** `vec_distance_cosine` | **48.6 ms** · 20,576/s | 814.8 ms · 1,227/s | **~16.8×** |
| **filtered KNN** (k=10 + metadata) | **555 ms** · 1,801/s | 2,132 ms · 469/s | **~3.8×** |
| **KNN** (k=10) | **661 ms** · 1,514/s | 2,199 ms · 455/s | **~3.3×** |
| insert (1000) | 13.9 s | 18.0 s | ~1.3× |
| update (1000) | 14.9 s | 16.4 s | ~1.1× |
| delete (500) | 7.8 s | 7.5 s | ~1.0× (noise) |

Read/compute operations — which return data across the JS↔native boundary — are **3–17×
faster** thanks to static linking + Nitro/JSI marshaling vs a runtime-loaded extension + bridge.
Write ops are bind/exec-bound, so closer. _(Relative comparison; both run in the same debug
build on the same device.)_

## Roadmap

The native registration is a single seam (`registerVectorExtensions`), ready for an ANN
backend (e.g. [usearch](https://github.com/unum-cloud/usearch), header-only C++ with ARM
NEON) to be added without core or JS API changes.
