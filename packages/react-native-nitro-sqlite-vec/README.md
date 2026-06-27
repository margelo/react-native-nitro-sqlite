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

## Roadmap

The native registration is a single seam (`registerVectorExtensions`), ready for an ANN
backend (e.g. [usearch](https://github.com/unum-cloud/usearch), header-only C++ with ARM
NEON) to be added without core or JS API changes.
