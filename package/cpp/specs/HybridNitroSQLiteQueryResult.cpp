#include "HybridNitroSQLiteQueryResult.hpp"
#include <NitroModules/ArrayBuffer.hpp>
#include <NitroModules/Null.hpp>
#include <NitroModules/Promise.hpp>
#include <unordered_map>
#include <variant>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

std::optional<double> HybridNitroSQLiteQueryResult::getInsertId() {
  return _insertId;
}

double HybridNitroSQLiteQueryResult::getRowsAffected() {
  return _rowsAffected;
}

SQLiteQueryResults HybridNitroSQLiteQueryResult::getResults() {
  return _results;
};

std::optional<SQLiteQueryTableMetadata> HybridNitroSQLiteQueryResult::getMetadata() {
  return _metadata;
}

} // namespace margelo::nitro::rnnitrosqlite
