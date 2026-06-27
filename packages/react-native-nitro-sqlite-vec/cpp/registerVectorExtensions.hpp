#pragma once

// usearch-ready seam: registers vendored vector extensions (sqlite-vec today) on the core's single sqlite3 via sqlite3_auto_extension.
namespace margelo::rnnitrosqlitevec {

// Idempotent: safe to call on every database open; registers exactly once.
void registerVectorExtensions();

} // namespace margelo::rnnitrosqlitevec
