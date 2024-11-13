#pragma once

#include "HybridNativeQueryResultSpec.hpp"
#include "types.hpp"
#include <map>

<<<<<<< HEAD
using namespace margelo::rnnitrosqlite;

namespace margelo::nitro::rnnitrosqlite {
=======
using namespace margelo::rnnitrosqlite;

namespace margelo::nitro::rnnitrosqlite {
>>>>>>> main

class HybridNativeQueryResult : public HybridNativeQueryResultSpec {
public:
  HybridNativeQueryResult() : HybridObject(TAG) {}
  HybridNativeQueryResult(std::optional<double> insertId, int rowsAffected, SQLiteQueryResults& results, std::optional<SQLiteQueryTableMetadata>& metadata)
      : HybridObject(TAG),
        _insertId(insertId),
        _rowsAffected(rowsAffected),
        _results(std::move(results)),
        _metadata(std::move(metadata)) {}

private:
  std::optional<double> _insertId;
  int _rowsAffected;
  SQLiteQueryResults _results;
  std::optional<SQLiteQueryTableMetadata> _metadata;

public:
  // Properties
  std::optional<double> getInsertId() override;
  double getRowsAffected() override;
  SQLiteQueryResults getResults() override;
  std::optional<SQLiteQueryTableMetadata> getMetadata() override;
};

<<<<<<< HEAD
} // namespace margelo::nitro::rnnitrosqlite
=======
} // namespace margelo::nitro::rnnitrosqlite
>>>>>>> main
