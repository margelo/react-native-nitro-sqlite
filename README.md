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
> Requires [Nitro modules](https://nitro.margelo.com/) and React Native `0.71` or later.

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
// Optional: open({ name: 'myDb.sqlite', location: '/some/path' })
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

```typescript
// Sync — blocks JS thread
const { results, rowsAffected } = db.execute(
  'UPDATE sometable SET somecolumn = ? WHERE somekey = ?',
  [0, 1]
)

// Async — off JS thread
const { results } = await db.executeAsync('SELECT * FROM sometable')
results.forEach((row) => console.log(row))
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

## Dynamic Column Metadata

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

Execute all statements in a file (e.g. a dump). Sync and async; async is better for large files.

```typescript
const { rowsAffected, commands } = db.loadFile('/absolute/path/to/file.sql')
// Or: await db.loadFileAsync('/absolute/path/to/file.sql')
```

---

# Loading existing databases

Databases are created under the app documents directory (iOS) or files directory (Android). To open an existing file elsewhere, use `location` in `open()`, or use relative paths from that root (e.g. `../www/myDb.sqlite`). On iOS you cannot access paths outside the app sandbox. You can also copy or move files with a React Native file library before opening.

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
      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'SQLITE_ENABLE_FTS5=1 SQLITE_ENABLE_MATH_FUNCTIONS=1'
    end
  end
end
```

**Android** — in `android/gradle.properties`:

```properties
nitroSqliteFlags=-DSQLITE_ENABLE_FTS5=1;-DSQLITE_ENABLE_MATH_FUNCTIONS=1
```

## App groups (iOS)

To put the database in an app group (e.g. for extensions), set `RNNitroSQLite_AppGroup` in your `Info.plist` to the app group ID and add the App Groups capability in Xcode.

---

# Exports

```typescript
import {
  open,
  NitroSQLiteError,
  typeORMDriver,
  enableSimpleNullHandling, // no-op from 9.3.0
} from 'react-native-nitro-sqlite'
import type { QueryResult, BatchQueryCommand, NitroSQLiteConnection, ... } from 'react-native-nitro-sqlite'
```

---

# Community

[Join the Margelo Community Discord](https://discord.gg/6CSHz2qAvA)

# License

MIT License.
