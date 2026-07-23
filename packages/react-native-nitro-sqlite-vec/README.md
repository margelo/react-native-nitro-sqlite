# react-native-nitro-sqlite-vec

Opt-in [sqlite-vec](https://github.com/asg017/sqlite-vec) support for [`react-native-nitro-sqlite`](https://github.com/margelo/react-native-nitro-sqlite). sqlite-vec is statically linked into the core package's SQLite build, so it does not load an extension at runtime.

## Installation

Install both this package and `react-native-nitro-sqlite`, then enable the native build flag.

```bash
npm install react-native-nitro-sqlite react-native-nitro-sqlite-vec
```

- **iOS:**
  ```bash
  NITRO_SQLITE_VEC=1 npx pod-install
  ```
- **Android:** add this to `android/gradle.properties` and rebuild:
  ```properties
  nitroSqliteVec=true
  ```

`isVecAvailable()` returns `false` when the native flag was not enabled.

## API

```ts
import { open } from 'react-native-nitro-sqlite'
import {
  createVectorTable,
  isVecAvailable,
  knnSearch,
  vecVersion,
} from 'react-native-nitro-sqlite-vec'

const db = open({ name: 'vectors.sqlite' })

if (!isVecAvailable(db)) {
  throw new Error('Enable sqlite-vec in the native build first')
}

console.log(vecVersion(db))
createVectorTable(db, 'embeddings', {
  dimensions: 3,
  type: 'float', // 'float' (default), 'int8', or 'bit'
  distanceMetric: 'L2', // 'L2' (default), 'cosine', or 'L1'
  column: 'embedding', // default
})

db.execute('INSERT INTO embeddings (rowid, embedding) VALUES (?, ?)', [
  1,
  '[0.1, 0.2, 0.3]',
])

const matches = knnSearch(db, 'embeddings', [0.1, 0.2, 0.25], 10)
// [{ rowid: 1, distance: 0.05... }]
```

`knnSearch()` accepts a JSON vector string or a `number[]` and returns rows containing `rowid`, `distance`, and any selected columns. `createVectorTable()` and `knnSearch()` interpolate table and column identifiers into SQL, so only pass trusted identifiers.

For the core SQLite API, see the [repository README](../../README.md).
