# Multiple connections

NitroSQLite can open several independent connections to the same database file. Each connection owns a native SQLite handle, an operation queue, and its transactions. Closing one connection leaves the others open.

Existing apps need no changes. `open({ name })` still opens the default connection for that name, and opening another default connection with that name throws. Set `connection: 'independent'` to open another handle. Connections can share a filename and location, or use the same filename in different locations.

## Set up one writer and one reader

Initialize the database and finish schema migrations before opening readers. Enable [WAL mode](https://www.sqlite.org/wal.html) on the writer to allow readers to run while another connection writes.

```ts
import { open } from 'react-native-nitro-sqlite'

const writer = open({ name: 'app.sqlite' })
await writer.executeAsync('PRAGMA journal_mode = WAL')
await writer.executeAsync('PRAGMA busy_timeout = 1000')
await writer.executeAsync(
  'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, value TEXT)',
)

const reader = open({
  name: 'app.sqlite',
  connection: 'independent',
  readOnly: true,
})
await reader.executeAsync('PRAGMA busy_timeout = 1000')

const [_, items] = await Promise.all([
  writer.executeAsync('INSERT INTO items (value) VALUES (?)', ['new item']),
  reader.executeAsync('SELECT * FROM items'),
])
```

The read in this example may run before the insert commits. If it must include that insert, await the write first, then start the read. A read-only connection requires an existing database and rejects writes to it. It cannot delete the database or attach other databases, including through raw SQL `ATTACH`.

WAL mode persists in the database file. Settings such as `busy_timeout` and `foreign_keys` belong to each connection, so configure them on every connection that needs them. NitroSQLite does not enable WAL or change SQLite's default busy timeout automatically.

## Adapt existing app code

After updating NitroSQLite, rebuild the iOS and Android apps so the new native connection methods are included. An update that replaces only JavaScript cannot add these methods to an older app binary.

Keep your existing connection as the writer. Add a shared reader connection in the database service, then pass the appropriate connection to each repository or query helper. Open a small, bounded number of connections and reuse them across screens and services.

Route operations explicitly. Code that fetches data can use the reader. Inserts, updates, deletes, schema migrations, imports, and write batches should use the writer. NitroSQLite does not inspect SQL keywords or distribute operations across connections. A statement beginning with `WITH`, for example, can perform a write, and a statement returning rows can still modify data.

Inside a transaction, pass the callback's `tx` object into every helper that belongs to that transaction. This includes reads that must see uncommitted writes. Work sent to another connection has a separate transaction and cannot see those writes.

```ts
await writer.transaction(async (tx) => {
  await tx.executeAsync('UPDATE items SET value = ? WHERE id = ?', ['edited', 1])
  const updated = await tx.executeAsync('SELECT * FROM items WHERE id = ?', [1])
  // updated includes this transaction's uncommitted change.
})

// This read starts after the writer commits.
const committed = await reader.executeAsync('SELECT * FROM items WHERE id = ?', [1])
```

Do not await a queued operation on the same connection from inside its transaction callback. That operation waits for the callback to finish. Use `tx.execute()` or `tx.executeAsync()` instead. A read transaction on a separate connection keeps its [snapshot](https://www.sqlite.org/isolation.html) until that transaction ends, even if a writer commits in the meantime.

Name-based calls such as `NitroSQLite.executeAsync('app.sqlite', ...)` always address the default connection. Use the object returned by `open()` for an independent connection. The existing TypeORM driver continues to use its default connection; using independent connections requires an adapter that retains the returned connection object.

## What can run in parallel

Operations on different connections can run on native worker threads concurrently. Each connection still serializes its own queued operations and protects the full lifetime of a transaction callback. `Promise.all()` on a single connection continues to queue work in call order.

SQLite allows one writer at a time per database file. Creating several writer connections does not make simultaneous writes execute in parallel. Prefer `executeBatchAsync()` for groups of writes that can share a transaction. Separate connections help when independent reads need to run alongside writes or other reads.

Competing connections can produce SQLite busy or locked errors. A bounded `busy_timeout` lets SQLite wait for some locks, but it does not eliminate every conflict. Catch failures at the operation or transaction boundary. If a transaction needs to be retried, retry the whole transaction only when the application can safely repeat its effects. Avoid synchronous calls with long timeouts because they block the JavaScript thread.

Keep read transactions short. In WAL mode, a long-lived reader can prevent checkpoints from advancing and allow the WAL file to grow. Choose connection counts and timeouts based on your app's workload, and measure latency on the devices you support.

## Close and delete

Await pending work before closing each connection. Closing a busy managed connection throws. Deletion fails while another connection has the file open, including through an attachment. Detach or close those connections first.

```ts
reader.close()
writer.close()
writer.delete()
```

Do not reuse a closed connection object. Open a new connection instead. Calls through `NitroSQLite.native` bypass the JavaScript queue and must not be mixed with managed transactions.

## Thread safety

Independent connections require SQLite's mutex support. NitroSQLite rejects `connection: 'independent'` when SQLite was built with `SQLITE_THREADSAFE=0`. Keep `nitroSQLite.threadSafe` enabled on iOS and avoid disabling SQLite thread safety through Android compiler flags. `performanceMode` is a separate setting and can remain enabled.

Per-connection queues cannot protect SQLite's process-wide state in a build without mutex support. `SQLITE_OPEN_FULLMUTEX` cannot restore mutex code removed at compile time. See [SQLite's threading modes](https://www.sqlite.org/threadsafe.html).
