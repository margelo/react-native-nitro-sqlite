# Nitro V1 optimizations

This branch combines the whole Nitro V1 stack with the optimizations below, so they can be benchmarked together against `main`. Each optimization is a separate commit. After benchmarking, cherry-pick the commits worth keeping into the PR listed for each one, then rebase the layers above it with `gh stack rebase --upstack`.

The stack in this branch, bottom to top: #465, #456, #453, #457, #458, #459, #460, #462, #463, #467.

## Changes

### 1. Write whole-number REAL values as JSON integers

- Commit: `perf: write whole-number REAL values as JSON integers`
- Target: #467 (`nitro-v1/any-json`)
- Benchmark: `300k wide rows · full read + access`, which was 20% slower than `main` on the iPhone 16

REAL values that hold whole numbers below 2^53 now go through the 64-bit integer formatter. On Apple platforms this replaces SQLite's formatter, which took about 40 ns per value against 7 ns on a Mac, and it drops the `.0` that SQLite appended. The wide benchmark table stores whole numbers in all four REAL columns, so each read formats 1.2 million of them. Android also gains a little, because integer formatting is about twice as fast as `std::to_chars` for doubles.

### 2. Format fractional numbers with `std::to_chars` on iOS 16.3 and later

- Commit: `perf(ios): format fractional numbers with std::to_chars on iOS 16.3+`
- Target: #467
- Benchmark: `100k fractional REAL rows · full read + access` (new) on iOS

Apple's libc++ only allows floating-point `std::to_chars` from iOS 16.3, and the package targets iOS 16.0. The encoder now looks the function up at runtime with `dlsym` and keeps SQLite's formatter for iOS 16.0 to 16.2. That roughly halves the formatting time for fractional values. The alternative is to raise the iOS minimum to 16.3 and call `std::to_chars` directly, which drops iOS 16.0 to 16.2. That decision is still open, and this commit becomes unnecessary if the minimum goes up.

### 3. Convert small results directly instead of parsing JSON

- Commit: `perf: convert small query results without parsing JSON`
- Target: #467
- Benchmarks: `1k indexed lookups · prepared`, which was 4% and 11% slower than `main` on the Galaxy S22 and Pixel 7a, and `WAL · 100 writes + 100 reads on separate connections`, which was 4% slower on the iPhone 16

Every result went through `JSON.parse`, including the empty result of each write and single-row lookups. A result batch now keeps native values until it holds more than 32 cells, then encodes the rows read so far as JSON and continues in JSON. Empty results skip conversion. The limit is `kNativeCellLimit` in `cpp/SQLiteQueryResults.cpp`. The device benchmarks put the break-even at about 20 to 30 cells, so retune it if the new numbers point elsewhere. Streamed batches also reserve the previous batch's JSON size up front. The result tests now run each edge case with 1 row and with 40 rows, so both conversion paths stay covered.

### 4. Move copied parameters into background operations

- Commit: `perf: move copied parameters into background operations`
- Target: #453 (`@chrispader/feat/nitro-v1`)
- Benchmarks: async inserts and async batches

`executeAsync` and prepared `executeAsync` copied their parameters twice before the worker thread used them, and `executeBatchAsync` copied every command three times. Each parameter is now copied once. In #453 the result type is still `NitroSQLiteQueryResult` and the prepared statement file is still `HybridNitroSQLitePreparedStatement.cpp`, so the cherry-pick needs those names.

### 5. Benchmark async reads and fractional REAL values

- Commit: `chore(example): benchmark async reads and fractional REAL values`
- Target: #469 (`chore/benchmark-read-cases`), merged into `main`. The stack picks it up when it is rebased onto `main`.

Adds `10k narrow rows · async read + access`, `300k wide rows · async read + access`, and `100k fractional REAL rows · full read + access`. Synchronous reads encode and parse results on the JavaScript thread, while asynchronous reads encode them on the connection's worker thread, which is where AnyJSON should help most. The existing cases keep their order and labels.

### 6. Benchmark app workloads

- Commit: `chore(example): benchmark app workloads`
- Target: #470 (`chore/benchmark-real-world`) against `main`. Drop this commit when the stack is rebased onto `main`, because #470 brings the same cases.

Adds WAL-mode cases modeled on apps: a chat app that stores 500 synced messages in a transaction, opens its inbox and 10 conversations, and launches 20 times, plus key-value storage, a response cache with 200 JSON documents of 9 KB, and a thumbnail cache with 120 BLOBs of 32 KB. It also adds async point lookups and synchronous inserts inside one transaction. On `main`, #470 also runs the chat cases through Drizzle and reads rows as arrays with `executeRaw`. This branch has neither API yet, so those cases are missing here. The response cache and thumbnail cases test two weak spots of the JSON encoding in #467: JSON documents stored as text are full of quotes the encoder must escape, and every BLOB is patched in after parsing.

## Not changed

- Asynchronous transactions on Android were 6% slower on the Galaxy S22 and 27% slower on the Pixel 7a. Both Nitro versions resolve promises through the same React Native call invoker with the same thread hops, and no code change accounts for the extra 60 µs per statement on the Pixel. Changes 3 and 4 remove some work per statement, but finding the cause needs a Perfetto trace of `main` and V1 on that phone.
- Synchronous batches still copy their parameters once. Removing that copy needs a non-owning batch type across `SQLiteExecuteBatch` and the statement group helper, for about 1% of the batch time.
- Every result builds a metadata object per column. Caching or skipping it would change the public result shape.
- Coalescing promise resolutions or briefly spinning the connection worker would cut thread wake-up latency for asynchronous statements, but needs a bigger design change or costs CPU time.
- The newest Nitro V1 nightly (102) has no changes to the C++ promise, callback, or AnyJSON code, and it renames `nitro.json` keys.
