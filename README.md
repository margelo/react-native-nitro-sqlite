<a href="https://margelo.com">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/img/banner-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="./assets/img/banner-light.png" />
    <img alt="Nitro Modules" src="./assets/img/banner-light.png" />
  </picture>
</a>

<br />

> [!IMPORTANT]
> `react-native-quick-sqlite` has been deprecated in favor of this new [Nitro module](https://nitro.margelo.com/) implementation.
>
> From major version `9.0.0` on, the package is `react-native-nitro-sqlite`. Bug fixes for `react-native-quick-sqlite@8.x.x` will continue for a limited time.

<div align="center">
  <pre align="center">
    npm i react-native-nitro-sqlite react-native-nitro-modules
    npx pod-install</pre>
  <a align="center" href="https://github.com/margelo">
    <img src="https://img.shields.io/github/followers/margelo?label=Follow%20%40margelo&style=social" />
  </a>
  <br />
  <a align="center" href="https://twitter.com/margelo_io">
    <img src="https://img.shields.io/twitter/follow/margelo_io?label=Follow%20%40margelo_io&style=social" />
  </a>
  <a align="center" href="https://bsky.app/profile/margelo.com">
    <img src="https://img.shields.io/twitter/follow/margelo_com?label=Follow%20%40margelo_com&style=social&logo=bluesky&url=https%3A%2F%2Fbsky.app%2Fprofile%2Fmargelo.com" style="pointer-events: 'none'" />
  </a>
</div>
<br />

> [!NOTE]
> Requires [Nitro modules](https://nitro.margelo.com/) and React Native `0.75` or later.

Nitro SQLite embeds SQLite and exposes a JSI API. Each operation is available in **sync** and **async** form; async runs off the JS thread to avoid blocking the UI.

---

# Installation

```bash
npm install react-native-nitro-sqlite react-native-nitro-modules
npx pod-install
```

---

# API overview

Open a database with `open()`. The returned connection is used for all operations; the database name is bound to that connection.

```typescript
import { open } from 'react-native-nitro-sqlite'

const db = open({ name: 'myDb.sqlite' })
// Optional: location is relative to the platform database directory.
// open({ name: 'myDb.sqlite', location: 'databases' })
```

| Method | Sync | Async | Description |
|--------|------|-------|-------------|
| **Execute** | `db.execute(query, params?)` | `db.executeAsync(query, params?)` | Run a single SQL statement. |
| **Batch** | `db.executeBatch(commands)` | `db.executeBatchAsync(commands)` | Run multiple statements in one transaction. |
| **Load file** | `db.loadFile(path)` | `db.loadFileAsync(path)` | Execute SQL from a file. |
| **Transaction** | — | `db.transaction(async (tx) => { ... })` | Run multiple statements in a transaction (async only). |
| **Lifecycle** | `db.close()`, `db.delete()` | — | Close or delete the database. |
| **Attach** | `db.attach(dbName, alias, location?)`, `db.detach(alias)` | — | Attach/detach another database. |

---

# Sync vs async

- **Sync** (`execute`, `executeBatch`, `loadFile`): Run on the JS thread. Use for small, fast work; heavy work can block the UI.
- **Async** (`executeAsync`, `executeBatchAsync`, `loadFileAsync`, `transaction`): Run off the JS thread. Prefer these for larger or many queries to keep the app responsive.

---

# Basic usage

## Execute (sync and async)

Both return a result with `results` (array of rows), `rowsAffected`, and `insertId` (when relevant). Rows are plain objects keyed by column name.

Query parameters accept `boolean`, `number`, `string`, `ArrayBuffer`, and `null`. Always bind user-supplied values as parameters rather than building SQL strings.

```typescript
// Sync — blocks JS thread
const { results, rowsAffected } = db.execute(
  'UPDATE sometable SET somecolumn = ? WHERE somekey = ?',
  [0, 1]
)

// Async — off JS thread
const { results } = await db.executeAsync('SELECT * FROM sometable')
results.forEach((row) => console.log(row))

// Type the row shape when it is known.
const users = db.execute<{ id: number; name: string }>(
  'SELECT id, name FROM users',
).rows._array
```

## Transactions (async only)

Use `db.transaction()` for multiple statements in a single transaction. The callback receives a `tx` object with `execute`, `executeAsync`, `commit`, and `rollback`. If the callback throws, the transaction is rolled back. Otherwise it is committed when the callback resolves (or you can call `tx.commit()` / `tx.rollback()` explicitly).

```typescript
await db.transaction(async (tx) => {
  tx.execute('UPDATE sometable SET somecolumn = ? WHERE somekey = ?', [0, 1])
  await tx.executeAsync('INSERT INTO sometable (id, name) VALUES (?, ?)', [2, 'foo'])
  // Uncaught error → rollback
  // Success → commit (or call tx.commit() / tx.rollback() yourself)
})
```

## Batch (sync and async)

Run many statements in one transaction. Each command has `query` and optional `params`. For one query with many parameter sets, use a single `query` and `params` as an array of arrays.

```typescript
const commands = [
  { query: 'CREATE TABLE IF NOT EXISTS TEST (id INTEGER, age INTEGER)' },
  { query: 'INSERT INTO TEST (id, age) VALUES (?, ?)', params: [1, 10] },
  { query: 'INSERT INTO TEST (id, age) VALUES (?, ?)', params: [2, 20] },
  {
    query: 'INSERT INTO TEST (id, age) VALUES (?, ?)',
    params: [
      [3, 30],
      [4, 40],
    ],
  },
]

const { rowsAffected } = db.executeBatch(commands)
// Or: await db.executeBatchAsync(commands)
```

# Column metadata

When you need column types or names for the result set, use the `metadata` field on the query result. Keys are column names; values include `name`, `type` (e.g. from `ColumnType`), and `index`.

```typescript
const { results, metadata } = db.execute('SELECT id, name FROM users LIMIT 1')
if (metadata) {
  for (const [columnName, meta] of Object.entries(metadata)) {
    console.log(columnName, meta.type, meta.index)
  }
}
```

---

# Attach / detach

Attach another database file under an alias; useful for JOINs across files or separate configs. Detach when no longer needed. Closing the main connection detaches all.

```typescript
db.attach('otherDb.sqlite', 'other', '/path/to/dir')
const { results } = db.execute(
  'SELECT * FROM main.users a INNER JOIN other.stats b ON a.id = b.user_id'
)
db.detach('other')
```

---

# Loading SQL files

Execute all statements in a file (e.g. a dump). The loader executes one non-empty SQL command per line inside an exclusive transaction, so multi-line statements are not supported. Sync and async are available; async is better for large files.

```typescript
const { rowsAffected, commands } = db.loadFile('/absolute/path/to/file.sql')
// Or: await db.loadFileAsync('/absolute/path/to/file.sql')
```

---

# Loading existing databases

Databases are created under the app documents directory (iOS) or files directory (Android). `location` is a directory path relative to that root, not an absolute file path. For example, `open({ name: 'myDb.sqlite', location: 'databases' })` opens `myDb.sqlite` under the `databases` directory. To use a database from another app-accessible location, copy or move it into this directory first. On iOS, files outside the app sandbox are inaccessible.

Close a connection before deleting its database. A connection must not be used after `close()` or `delete()`.

```ts
db.close()
db.delete()
```

---

# Errors

The JavaScript helpers—including `open`, `execute`, `executeAsync`, batch methods, transactions, and `close`—normalize database failures to `NitroSQLiteError`. Catch this class when you need to distinguish database failures from errors thrown by your application.

```ts
import { NitroSQLiteError } from 'react-native-nitro-sqlite'

try {
  db.execute('SELECT * FROM missing_table')
} catch (error) {
  if (error instanceof NitroSQLiteError) {
    console.error(error.message)
  }
}
```

---

# Vector search (sqlite-vec)

Vector search is an opt-in companion package. It statically links sqlite-vec into Nitro SQLite's SQLite build—there is no runtime extension loading.

1. Install the companion package:
   ```bash
   npm install react-native-nitro-sqlite-vec
   ```
2. Enable it for each native platform, then rebuild the app:
   - **iOS:** run CocoaPods with `NITRO_SQLITE_VEC=1`, for example:
     ```bash
     NITRO_SQLITE_VEC=1 npx pod-install
     ```
   - **Android:** add this to `android/gradle.properties`:
     ```properties
     nitroSqliteVec=true
     ```

The companion exports small typed helpers. Its full API is also documented in [the package README](./packages/react-native-nitro-sqlite-vec/README.md).

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
  throw new Error('sqlite-vec is not enabled in this build')
}

console.log(vecVersion(db))
createVectorTable(db, 'embeddings', { dimensions: 3 })
db.execute('INSERT INTO embeddings (rowid, embedding) VALUES (?, ?)', [
  1,
  '[0.1, 0.2, 0.3]',
])

const matches = knnSearch(db, 'embeddings', [0.1, 0.2, 0.25], 10)
```

The helper APIs interpolate table and column names into SQL; use trusted identifiers only.

---

# TypeORM

You can use this package as a TypeORM driver. Because of Metro and Node resolution, TypeORM’s `package.json` must be exposed and the driver aliased.

1. **Expose TypeORM `package.json`** (in TypeORM’s `package.json` `exports` add `"./package.json": "./package.json"`), then:
   ```sh
   npx patch-package --exclude 'nothing' typeorm
   ```
2. **Alias the driver** in `babel.config.js`:
   ```js
   plugins: [
     [
       'module-resolver',
       {
         alias: {
           'react-native-sqlite-storage': 'react-native-nitro-sqlite',
         },
       },
     ],
   ]
   ```
   Install: `npm i -D babel-plugin-module-resolver`
3. **Use the driver**:
   ```ts
   import { typeORMDriver } from 'react-native-nitro-sqlite'

   const datasource = new DataSource({
     type: 'react-native',
     database: 'typeormdb',
     location: '.',
     driver: typeORMDriver,
     entities: [...],
     synchronize: true,
   })
   ```

---

# Configuration

## Use system SQLite on iOS

To use the system SQLite instead of the bundled one:

```bash
NITRO_SQLITE_USE_PHONE_VERSION=1 npx pod-install
```

## Compile-time options (e.g. FTS5, Geopoly)

**iOS** — in your app’s `ios/Podfile`, in a `post_install` block:

```ruby
installer.pods_project.targets.each do |target|
  if target.name == "RNNitroSQLite"
    target.build_configurations.each do |config|
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'SQLITE_ENABLE_FTS5=1'
    end
  end
end
```

**Android** — in `android/gradle.properties`:

```properties
nitroSqliteFlags="-DSQLITE_ENABLE_FTS5=1"
```

## App groups (iOS)

To put the database in an app group (e.g. for extensions), set `RNNitroSQLite_AppGroup` in your `Info.plist` to the app group ID and add the App Groups capability in Xcode.

---

# Exports

```typescript
import {
  open,
  NitroSQLite,
  NitroSQLiteError,
  typeORMDriver,
} from 'react-native-nitro-sqlite'
import type {
  BatchQueryCommand,
  BatchQueryResult,
  FileLoadResult,
  NitroSQLiteConnection,
  QueryResult,
  SQLiteValue,
  Transaction,
} from 'react-native-nitro-sqlite'
```

`open()` is the recommended API. `NitroSQLite` exposes the underlying database-name-based methods for advanced integrations; prefer the connection returned by `open()` because it binds the database name and adds the JavaScript transaction and result helpers.

---

# Community

[Join the Margelo Community Discord](https://discord.gg/6CSHz2qAvA)

# License

MIT License.
