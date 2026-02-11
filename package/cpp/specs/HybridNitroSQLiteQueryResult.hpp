#pragma once

#include "HybridNitroSQLiteQueryResultSpec.hpp"
#include "types.hpp"
#include <map>

using namespace margelo::rnnitrosqlite;

namespace margelo::nitro::rnnitrosqlite {

class HybridNitroSQLiteQueryResult : public HybridNitroSQLiteQueryResultSpec {
public:
  HybridNitroSQLiteQueryResult() : HybridObject(TAG) {}
  HybridNitroSQLiteQueryResult(SQLiteQueryResults results, std::optional<double> insertId, double rowsAffected,
                               std::optional<SQLiteQueryTableMetadata> metadata)
      : HybridObject(TAG), _insertId(insertId), _rowsAffected(rowsAffected), _results(std::move(results)), _metadata(metadata) {}

private:
  std::optional<double> _insertId;
  double _rowsAffected;
  SQLiteQueryResults _results;
  std::optional<SQLiteQueryTableMetadata> _metadata;

public:
  // Properties
  std::optional<double> getInsertId() override;
  double getRowsAffected() override;
  SQLiteQueryResults getResults() override;
  std::optional<SQLiteQueryTableMetadata> getMetadata() override;
};

} // namespace margelo::nitro::rnnitrosqlite
