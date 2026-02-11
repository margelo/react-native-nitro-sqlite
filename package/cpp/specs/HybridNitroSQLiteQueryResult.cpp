#include "HybridNitroSQLiteQueryResult.hpp"
#include <NitroModules/ArrayBuffer.hpp>
#include <NitroModules/Null.hpp>
#include <NitroModules/Promise.hpp>
#include <unordered_map>
#include <variant>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

namespace {

/**
 * Compute the approximate external memory size of a single SQLiteValue.
 *
 * We only need to account for heap allocations that can actually put
 * pressure on the JS GC – in practice, that means:
 * - `std::string` contents,
 * - `ArrayBuffer` instances (object + underlying bytes).
 *
 * Other variants (`NullType`, `bool`, `double`) are small and live inline.
 */
size_t getValueExternalMemorySize(const SQLiteValue& value) {
  if (std::holds_alternative<std::string>(value)) {
    const auto& stringValue = std::get<std::string>(value);
    return stringValue.capacity();
  }

  if (std::holds_alternative<std::shared_ptr<ArrayBuffer>>(value)) {
    const auto& buffer = std::get<std::shared_ptr<ArrayBuffer>>(value);
    if (!buffer) {
      return 0;
    }

    const auto bufferSize = buffer->size();
    return sizeof(*buffer.get()) + bufferSize;
  }

  return 0;
}

/**
 * Compute the approximate external memory size of a single result row.
 * This includes:
 * - Column name string capacities,
 * - Heap usage for the actual SQLiteValue contents.
 */
size_t getRowExternalMemorySize(const SQLiteQueryResultRow& row) {
  size_t size = 0;

  for (const auto& entry : row) {
    const auto& columnName = entry.first;
    const auto& value = entry.second;

    size += columnName.capacity();
    size += getValueExternalMemorySize(value);
  }

  return size;
}

/**
 * Compute the approximate external memory size of the full result set.
 * We add:
 * - The vector's backing storage,
 * - All rows (column names + values).
 */
size_t getResultsExternalMemorySize(const SQLiteQueryResults& results) {
  size_t size = 0;

  const auto resultCapacity = results.capacity();
  size += resultCapacity * sizeof(SQLiteQueryResultRow);

  for (const auto& row : results) {
    size += getRowExternalMemorySize(row);
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
  size_t size = 0;

  for (const auto& entry : metadata) {
    const auto& columnName = entry.first;
    const auto& columnMeta = entry.second;

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
