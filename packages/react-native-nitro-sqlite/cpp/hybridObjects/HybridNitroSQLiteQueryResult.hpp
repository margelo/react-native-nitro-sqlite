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

  /**
   * Approximate the native memory used by this query result.
   *
   * We account for:
   * - The size of this C++ object (`sizeof(*this)`),
   * - All rows and columns (including column name strings),
   * - String values stored in the result set,
   * - ArrayBuffers used for BLOB columns (object overhead + raw byte size),
   * - Column metadata strings.
   *
   * This is a best-effort estimate and intentionally focuses on external
   * heap allocations that can put pressure on the JS GC.
   */
  size_t getExternalMemorySize() noexcept override;
};

} // namespace margelo::nitro::rnnitrosqlite
