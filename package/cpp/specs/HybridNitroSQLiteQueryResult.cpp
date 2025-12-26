#include "HybridNitroSQLiteQueryResult.hpp"
#include <NitroModules/ArrayBuffer.hpp>
#include <NitroModules/Null.hpp>
#include <NitroModules/Promise.hpp>
#include <unordered_map>
#include <variant>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

std::optional<double> HybridNitroSQLiteQueryResult::getInsertId() {
  return _result.insertId;
}

double HybridNitroSQLiteQueryResult::getRowsAffected() {
  return _result.rowsAffected;
}

SQLiteQueryResults HybridNitroSQLiteQueryResult::getResults() {
  return _result.results;
};

std::optional<NitroSQLiteQueryResultRows> HybridNitroSQLiteQueryResult::getRows() {
  if (_result.results.empty()) {
    return std::nullopt;
  }
  
  auto rows = _result.results;

  // Create the item function that returns a Promise
  auto itemFunction = [rows](double idx) -> std::shared_ptr<Promise<std::optional<SQLiteQueryResultRow>>> {
    return Promise<std::optional<SQLiteQueryResultRow>>::async([rows, idx]() -> std::optional<SQLiteQueryResultRow> {
      const auto index = static_cast<size_t>(idx);
      if (index >= rows.size()) {
        return std::nullopt;
      }
      return rows[index];
    });
  };

  const auto length = static_cast<double>(rows.size());
  return NitroSQLiteQueryResultRows(std::move(rows), length, itemFunction);
}

std::optional<SQLiteQueryTableMetadata> HybridNitroSQLiteQueryResult::getMetadata() {
  return _result.metadata;
}

} // namespace margelo::nitro::rnnitrosqlite
