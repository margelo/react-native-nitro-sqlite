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
> From major version `9.0.0` on, will be shipped in the NPM package `react-native-nitro-sqlite`. We will still provide bug fixes to `react-native-quick-sqlite@8.x.x` for the coming weeks/months.

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
> `react-native-nitro-sqlite` is based on [Nitro modules](https://nitro.margelo.com/). You need to install `react-native-nitro-modules` as a dependency.

Nitro SQLite embeds the latest version of SQLite and provides a low-level JSI-backed API to execute SQL queries.

Performance metrics are intentionally not presented, [anecdotic testimonies](https://dev.to/craftzdog/a-performant-way-to-use-pouchdb7-on-react-native-in-2022-24ej) suggest anywhere between 2x and 5x speed improvement. On small queries you might not notice a difference with the old bridge but as you send large data to JS the speed increase is considerable.

Starting on version `8.0.0` only React-Native `0.71` onwards is supported. This is due to internal changes to React-Native artifacts. If you are on < `0.71` use the latest `7.x.x` version.

TypeORM is officially supported, however, there is currently a parsing issue with React-Native 0.71 and its babel configuration and therefore it will not work, nothing wrong with this package, this is purely an issue on TypeORM.

## API

```typescript
import {open} from 'react-native-nitro-sqlite'

const db = open('myDb.sqlite')

// The db object now contains the following methods:

db = {
  close: () => void,
  delete: () => void,
  attach: (dbNameToAttach: string, alias: string, location?: string) => void,
  detach: (alias: string) => void,
  transaction: (fn: (tx: Transaction) => void) => Promise<void>,
  execute: (query: string, params?: any[]) => QueryResult,
  executeAsync: (
    query: string,
    params?: any[]
  ) => Promise<QueryResult>,
  executeBatch: (commands: BatchQueryCommand[]) => BatchQueryResult,
  executeBatchAsync: (commands: BatchQueryCommand[]) => Promise<BatchQueryResult>,
  loadFile: (location: string) => FileLoadResult;,
  loadFileAsync: (location: string) => Promise<FileLoadResult>
}
```

### Simple queries

The basic query is **synchronous**, it will block rendering on large operations, further below you will find async versions.

```typescript
import { open } from 'react-native-nitro-sqlite';

try {
  const db = open('myDb.sqlite');

  let { rows } = db.execute('SELECT somevalue FROM sometable');

  rows.forEach((row) => {
    console.log(row);
  });

  let { rowsAffected } = await db.executeAsync(
    'UPDATE sometable SET somecolumn = ? where somekey = ?',
    [0, 1]
  );

  console.log(`Update affected ${rowsAffected} rows`);
} catch (e) {
  console.error('Something went wrong executing SQL commands:', e.message);
}
```

### Transactions

Throwing an error inside the callback will ROLLBACK the transaction.

If you want to execute a large set of commands as fast as possible you should use the `executeBatch` method, it wraps all the commands in a transaction and has less overhead.

```typescript
await NitroSQLite.transaction('myDatabase', (tx) => {
  const { status } = tx.execute(
    'UPDATE sometable SET somecolumn = ? where somekey = ?',
    [0, 1]
  );

  // offload from JS thread
  await tx.executeAsync = tx.executeAsync(
    'UPDATE sometable SET somecolumn = ? where somekey = ?',
    [0, 1]
  );

  // Any uncatched error ROLLBACK transaction
  throw new Error('Random Error!');

  // You can manually commit or rollback
  tx.commit();
  // or
  tx.rollback();
});
```

### Batch operation

Batch execution allows the transactional execution of a set of commands

```typescript
const commands = [
  {query: 'CREATE TABLE TEST (id integer)'},
  {query: 'INSERT INTO TEST (id) VALUES (?)', params: [value1]},
  {query: 'INSERT INTO TEST (id) VALUES (?)', params: [value2]},
  {query: 'INSERT INTO TEST (id) VALUES (?)', params: [value3, value4, value5, value6]},
];

const res = NitroSQLite.executeSqlBatch('myDatabase', commands);

console.log(`Batch affected ${result.rowsAffected} rows`);
```

### Dynamic Column Metadata

In some scenarios, dynamic applications may need to get some metadata information about the returned result set.

This can be done by testing the returned data directly, but in some cases may not be enough, for example when data is stored outside
SQLite datatypes. When fetching data directly from tables or views linked to table columns, SQLite can identify the table declared types:

```typescript
let { metadata } = NitroSQLite.executeSql(
  'myDatabase',
  'SELECT int_column_1, bol_column_2 FROM sometable'
);

metadata.forEach((column) => {
  // Output:
  // int_column_1 - INTEGER
  // bol_column_2 - BOOLEAN
  console.log(`${column.columnName} - ${column.columnDeclaredType}`);
});
```

### Async operations

You might have too much SQL to process and it will cause your application to freeze. There are async versions for some of the operations. This will offload the SQLite processing to a different thread.

```ts
NitroSQLite.executeAsync(
  'myDatabase',
  'SELECT * FROM "User";',
  []).then(({rows}) => {
    console.log('users', rows);
  })
);
```

### Attach or Detach other databases

SQLite supports attaching or detaching other database files into your main database connection through an alias.
You can do any operation you like on this attached database like JOIN results across tables in different schemas, or update data or objects.
These databases can have different configurations, like journal modes, and cache settings.

You can, at any moment, detach a database that you don't need anymore. You don't need to detach an attached database before closing your connection. Closing the main connection will detach any attached databases.

SQLite has a limit for attached databases: A default of 10, and a global max of 125

References: [Attach](https://www.sqlite.org/lang_attach.html) - [Detach](https://www.sqlite.org/lang_detach.html)

```ts
NitroSQLite.attach('mainDatabase', 'statistics', 'stats', '../databases');

const res = NitroSQLite.executeSql(
  'mainDatabase',
  'SELECT * FROM some_table_from_mainschema a INNER JOIN stats.some_table b on a.id_column = b.id_column'
);

// You can detach databases at any moment
NitroSQLite.detach('mainDatabase', 'stats');
if (!detachResult.status) {
  // Database de-attached
}
```

### Loading SQL Dump Files

If you have a plain SQL file, you can load it directly, with low memory consumption.

```typescript
const { rowsAffected, commands } = NitroSQLite.loadFile(
  'myDatabase',
  '/absolute/path/to/file.sql'
);
```

Or use the async version which will load the file in another native thread

```typescript
NitroSQLite.loadFileAsync('myDatabase', '/absolute/path/to/file.sql').then(
  (res) => {
    const { rowsAffected, commands } = res;
  }
);
```

## Use built-in SQLite

On iOS you can use the embedded SQLite, when running `pod-install` add an environment flag:

```
Nitro_SQLITE_USE_PHONE_VERSION=1 npx pod-install
```

On Android, it is not possible to link (using C++) the embedded SQLite. It is also a bad idea due to vendor changes, old android bugs, etc. Unfortunately, this means this library will add some megabytes to your app size.

## TypeORM

This library is pretty barebones, you can write all your SQL queries manually but for any large application, an ORM is recommended.

You can use this library as a driver for [TypeORM](https://github.com/typeorm/typeorm). However, there are some incompatibilities you need to take care of first.

Starting on Node14 all files that need to be accessed by third-party modules need to be explicitly declared, TypeORM does not export its `package.json` which is needed by Metro, we need to expose it and make those changes "permanent" by using [patch-package](https://github.com/ds300/patch-package):

```json
// package.json stuff up here
"exports": {
    "./package.json": "./package.json", // ADD THIS
    ".": {
      "types": "./index.d.ts",
// The rest of the package json here
```

After you have applied that change, do:

```sh
npx patch-package --exclude 'nothing' typeorm
```

Now every time you install your node_modules that line will be added.

Next, we need to trick TypeORM to resolve the dependency of `react-native-sqlite-storage` to `react-native-nitro-sqlite`, on your `babel.config.js` add the following:

```js
plugins: [
  // w/e plugin you already have
  ...,
  [
    'module-resolver',
    {
      alias: {
        "react-native-sqlite-storage": "react-native-nitro-sqlite"
      },
    },
  ],
]
```

You will need to install the babel `module-resolver` plugin:

```sh
npx add babel-plugin-module-resolver
```

Finally, you will now be able to start the app without any metro/babel errors (you will also need to follow the instructions on how to setup TypeORM), now we can feed the driver into TypeORM:

```ts
import { typeORMDriver } from 'react-native-nitro-sqlite'

datasource = new DataSource({
  type: 'react-native',
  database: 'typeormdb',
  location: '.',
  driver: typeORMDriver,
  entities: [...],
  synchronize: true,
});
```

# Loading existing DBs

The library creates/opens databases by appending the passed name plus, the [documents directory on iOS](https://github.com/margelo/react-native-nitro-sqlite/blob/733e876d98896f5efc80f989ae38120f16533a66/ios/NitroSQLite.mm#L34-L35) and the [files directory on Android](https://github.com/margelo/react-native-nitro-sqlite/blob/main/android/src/main/java/com/margelo/rnnitrosqlite/NitroSQLiteBridge.java#L16), this differs from other SQL libraries (some place it in a `www` folder, some in androids `databases` folder, etc.).

If you have an existing database file you want to load you can navigate from these directories using dot notation. e.g. `../www/myDb.sqlite`. Note that on iOS the file system is sand-boxed, so you cannot access files/directories outside your app bundle directories.

Alternatively, you can place/move your database file using one of the many react-native fs libraries.

## Enable compile-time options

By specifying pre-processor flags, you can enable optional features like FTS5, Geopoly, etc.

### iOS

Add a `post_install` block to your `<PROJECT_ROOT>/ios/Podfile` like so:

```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    if target.name == "react-native-nitro-sqlite" then
      target.build_configurations.each do |config|
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'SQLITE_ENABLE_FTS5=1'
      end
    end
  end
end
```

Replace the `<SQLITE_FLAGS>` part with the flags you want to add.
For example, you could add `SQLITE_ENABLE_FTS5=1` to `GCC_PREPROCESSOR_DEFINITIONS` to enable FTS5 in the iOS project.

### Android

You can specify flags via `<PROJECT_ROOT>/android/gradle.properties` like so:

```
nitroSqliteFlags="<SQLITE_FLAGS>"
```

## Additional configuration

### App groups (iOS only)

On iOS, the SQLite database can be placed in an app group, in order to make it accessible from other apps in that app group. E.g. for sharing capabilities.

To use an app group, add the app group ID as the value for the `RNNitroSQLite_AppGroup` key in your project's `Info.plist` file. You'll also need to configure the app group in your project settings. (Xcode -> Project Settings -> Signing & Capabilities -> Add Capability -> App Groups)

## Community Discord

[Join the Margelo Community Discord](https://discord.gg/6CSHz2qAvA) to chat about react-native-nitro-sqlite or other Margelo libraries.

## License

MIT License.
