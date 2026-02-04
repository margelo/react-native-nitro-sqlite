#pragma once

#include "HybridNitroSQLiteQueryResultSpec.hpp"
#include "types.hpp"
#include <map>

using namespace margelo::rnnitrosqlite;

namespace margelo::nitro::rnnitrosqlite {

class HybridNitroSQLiteQueryResult : public HybridNitroSQLiteQueryResultSpec {
public:
  HybridNitroSQLiteQueryResult() : HybridObject(TAG) {}
  HybridNitroSQLiteQueryResult(SQLiteExecuteQueryResult&& result) : HybridObject(TAG), _result(std::move(result)) {}

private:
  SQLiteExecuteQueryResult _result;

public:
  // Properties
  std::optional<double> getInsertId() override;
  double getRowsAffected() override;
  SQLiteQueryResults getResults() override;
  std::optional<NitroSQLiteQueryResultRows> getRows() override;
  std::optional<SQLiteQueryTableMetadata> getMetadata() override;
};

} // namespace margelo::nitro::rnnitrosqlite
