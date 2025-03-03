#pragma once

#include "HybridNativeQueryResultSpec.hpp"
#include "types.hpp"
#include <map>

using namespace margelo::rnnitrosqlite;

namespace margelo::nitro::rnnitrosqlite {

class HybridNativeQueryResult : public HybridNativeQueryResultSpec {
public:
  HybridNativeQueryResult() : HybridObject(TAG) {}
  HybridNativeQueryResult(SQLiteExecuteQueryResult&& result): _result(std::move(result)) {}

private:
  SQLiteExecuteQueryResult _result;

public:
  // Properties
  double getInsertId() override;
  double getRowsAffected() override;
  SQLiteQueryResults getResults() override;
  std::optional<SQLiteQueryTableMetadata> getMetadata() override;
};

} // namespace margelo::nitro::rnnitrosqlite
