#pragma once

#include <cstddef>
#include <sqlite3.h>
#include <string>
#include <utility>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

// The callbacks keep statement ownership, binding, and errors with the caller.
// The loop is shared with the host test so its preparation count is observable.
template <typename Params, typename Prepare, typename Bind, typename Consume, typename Fail>
std::pair<int, int> executeStatementGroup(sqlite3* db, const std::string& query, const std::vector<Params>& parameterSets,
                                          Prepare&& prepare, Bind&& bind, Consume&& consume, Fail&& fail) {
  if (parameterSets.empty()) {
    return {0, 0};
  }

  auto statement = prepare(db, query);
  const bool isReadOnly = sqlite3_stmt_readonly(statement.get()) != 0;
  int rowsAffected = 0;

  for (size_t index = 0; index < parameterSets.size(); index++) {
    if (index > 0) {
      if (sqlite3_reset(statement.get()) != SQLITE_OK) {
        fail(db);
      }
      if (sqlite3_clear_bindings(statement.get()) != SQLITE_OK) {
        fail(db);
      }
    }

    bind(statement.get(), parameterSets[index]);
    consume(db, statement.get());
    if (!isReadOnly) {
      rowsAffected += sqlite3_changes(db);
    }
  }

  return {rowsAffected, static_cast<int>(parameterSets.size())};
}

} // namespace margelo::nitro::rnnitrosqlite
