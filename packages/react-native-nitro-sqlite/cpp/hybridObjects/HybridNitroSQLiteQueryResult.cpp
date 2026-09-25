#include "HybridNitroSQLiteQueryResult.hpp"
#include <NitroModules/ArrayBuffer.hpp>

namespace margelo::nitro::rnnitrosqlite {

namespace {

  constexpr size_t nodePadding = 24;

  size_t getResultsExternalMemorySize(const SQLiteQueryResults& results) {
    const auto& data = *results.data;
    size_t size = sizeof(SQLiteQueryResultData) + sizeof(void*) * 2;
    size += data.columnNames.capacity() * sizeof(std::string);
    for (const auto& name : data.columnNames) {
      size += name.capacity();
    }
    size += data.rows.capacity() * sizeof(SQLiteQueryResultRow);
    for (const auto& row : data.rows) {
      size += row.capacity() * sizeof(SQLiteValue);
      for (const auto& value : row) {
        if (const auto* text = std::get_if<std::string>(&value)) {
          size += text->capacity();
        } else if (const auto* blob = std::get_if<std::shared_ptr<ArrayBuffer>>(&value)) {
          if (*blob) {
            size += sizeof(ArrayBuffer) + (*blob)->size();
          }
        }
      }
    }

    return size;
  }

  /**
   * Compute the approximate external memory size of the table metadata.
   * We include:
   * - Column name string capacities (map keys),
   * - Metadata contents, especially the `name` string on each metadata entry.
   */
  size_t getMetadataExternalMemorySize(const SQLiteQueryTableMetadata& metadata) {
    size_t size = metadata.bucket_count() * sizeof(void*);
    size += metadata.size() * (sizeof(SQLiteQueryTableMetadata::value_type) + nodePadding);

    for (const auto& [columnName, columnMeta] : metadata) {
      size += columnName.capacity();
      size += columnMeta.name.capacity();
    }

    return size;
  }

} // namespace

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

size_t HybridNitroSQLiteQueryResult::getExternalMemorySize() noexcept {
  size_t size = sizeof(*this);

  size += getResultsExternalMemorySize(_results);

  if (_metadata) {
    size += getMetadataExternalMemorySize(*_metadata);
  }

  return size;
}

} // namespace margelo::nitro::rnnitrosqlite
