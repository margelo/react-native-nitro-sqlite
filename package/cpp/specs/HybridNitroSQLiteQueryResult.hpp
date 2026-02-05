#pragma once

#include "HybridNitroSQLiteQueryResultSpec.hpp"
#include "types.hpp"
#include <map>

using namespace margelo::rnnitrosqlite;

namespace margelo::nitro::rnnitrosqlite {

class HybridNitroSQLiteQueryResult : public HybridNitroSQLiteQueryResultSpec {
public:
  HybridNitroSQLiteQueryResult() : HybridObject(TAG) {}
  HybridNitroSQLiteQueryResult(SQLiteQueryResults results, std::optional<double> insertId, double rowsAffected, std::optional<SQLiteQueryTableMetadata> metadata) {
    HybridNitroSQLiteQueryResult();
    
    _results = results;
    _insertId = insertId;
    _metadata = metadata;
    
    if (!_results.empty()) {
      auto rows = _results;

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
      _rows = NitroSQLiteQueryResultRows(std::move(rows), length, itemFunction);
    }
    
    
  }

private:
  std::optional<double> _insertId;
  double _rowsAffected;
  SQLiteQueryResults _results;
  std::optional<NitroSQLiteQueryResultRows> _rows;
  std::optional<SQLiteQueryTableMetadata>_metadata;

public:
  // Properties
  std::optional<double> getInsertId() override;
  double getRowsAffected() override;
  SQLiteQueryResults getResults() override;
  std::optional<NitroSQLiteQueryResultRows> getRows() override;
  std::optional<SQLiteQueryTableMetadata> getMetadata() override;
};

} // namespace margelo::nitro::rnnitrosqlite
