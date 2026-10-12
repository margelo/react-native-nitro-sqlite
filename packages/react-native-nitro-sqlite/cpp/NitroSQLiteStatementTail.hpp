#pragma once

#include <sqlite3.h>

namespace margelo::nitro::rnnitrosqlite {

// sqlite3_prepare_v2 compiles only the first statement of a query and points its tail at the rest.
// Preparing that tail lets SQLite decide whether it holds more than whitespace, comments, or semicolons:
// those prepare to a null statement, while another statement prepares or fails to prepare.
// Shared with the host test so the check runs against the bundled SQLite.
inline bool hasTrailingStatement(sqlite3* db, const char* tail) {
  if (tail == nullptr || *tail == '\0') {
    return false;
  }

  sqlite3_stmt* statement = nullptr;
  const int status = sqlite3_prepare_v2(db, tail, -1, &statement, nullptr);
  sqlite3_finalize(statement);
  return status != SQLITE_OK || statement != nullptr;
}

} // namespace margelo::nitro::rnnitrosqlite
