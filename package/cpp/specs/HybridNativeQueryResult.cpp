#include "HybridNativeQueryResult.hpp"

namespace margelo::nitro::rnnitrosqlite {

std::optional<double> HybridNativeQueryResult::getInsertId() {
  return _result.insertId;
}

double HybridNativeQueryResult::getRowsAffected() {
  return _result.rowsAffected;
}

SQLiteQueryResults HybridNativeQueryResult::getResults() {
  return _result.results;
};

std::optional<SQLiteQueryTableMetadata> HybridNativeQueryResult::getMetadata() {
  return _result.metadata;
}

} // namespace margelo::nitro::rnnitrosqlite
