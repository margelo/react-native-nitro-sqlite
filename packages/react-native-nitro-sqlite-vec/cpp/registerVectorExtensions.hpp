#pragma once

// Single registration seam for vector SQLite extensions shipped by
// react-native-nitro-sqlite-vec.
//
// The native sources here are compiled INTO the core react-native-nitro-sqlite
// library (when the `nitroSqliteVec` build flag is enabled), so they share the
// core's single sqlite3 build. The core calls registerVectorExtensions() once,
// before opening any connection, which auto-registers the extensions against
// that sqlite3 via sqlite3_auto_extension.
//
// This is the usearch-ready seam: additional ANN backends (e.g. usearch) are
// added by vendoring their amalgamation alongside sqlite-vec and adding one
// more sqlite3_auto_extension(...) line in the .cpp — no core or JS changes.

namespace margelo::rnnitrosqlitevec {

// Idempotent: safe to call on every database open; registers exactly once.
void registerVectorExtensions();

} // namespace margelo::rnnitrosqlitevec
