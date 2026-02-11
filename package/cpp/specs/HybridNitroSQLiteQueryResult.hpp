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
      : HybridObject(TAG), _insertId(insertId), _rowsAffected(rowsAffected), _results(std::move(results)), _metadata(metadata) {
    if (_results.empty()) {
      // Empty rows: empty vector, length 0, item callback always returns null
      auto emptyItem = [](double /* idx */) -> std::shared_ptr<Promise<std::optional<SQLiteQueryResultRow>>> {
        return Promise<std::optional<SQLiteQueryResultRow>>::async([]() -> std::optional<SQLiteQueryResultRow> { return std::nullopt; });
      };
      _rows = NitroSQLiteQueryResultRows(SQLiteQueryResults{}, 0.0, std::move(emptyItem));
      return;
    }

    auto rows = _results;
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
    _rows = NitroSQLiteQueryResultRows(std::move(rows), length, std::move(itemFunction));
  }

private:
  std::optional<double> _insertId;
  double _rowsAffected;
  SQLiteQueryResults _results;
  std::optional<NitroSQLiteQueryResultRows> _rows;
  std::optional<SQLiteQueryTableMetadata> _metadata;

public:
  // Properties
  std::optional<double> getInsertId() override;
  double getRowsAffected() override;
  SQLiteQueryResults getResults() override;
  std::optional<NitroSQLiteQueryResultRows> getRows() override;
  std::optional<SQLiteQueryTableMetadata> getMetadata() override;
};

} // namespace margelo::nitro::rnnitrosqlite
