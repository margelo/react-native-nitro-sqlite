#pragma once

#include <string>
#include <NitroModules/ArrayBuffer.hpp>
#include "SQLiteQueryColumnMetadata.hpp"
#include "ColumnType.hpp"
#include "SQLiteNullValue.hpp"

using namespace margelo::nitro;
using namespace margelo::nitro::rnnitrosqlite;

namespace margelo::rnnitrosqlite {

using SQLiteValue = std::variant<std::string, double, bool, std::shared_ptr<ArrayBuffer>, SQLiteNullValue>;
using SQLiteQueryParams = std::vector<SQLiteValue>;
using SQLiteQueryResultRow = std::unordered_map<std::string, SQLiteValue>;
using SQLiteQueryResults = std::vector<SQLiteQueryResultRow>;
using SQLiteQueryTableMetadata = std::unordered_map<std::string, SQLiteQueryColumnMetadata>;

struct SQLiteOperationResult {
  int rowsAffected;
  double insertId;
  int commands;
};

struct SQLiteExecuteQueryResult {
  int rowsAffected;
  double insertId;

  std::unique_ptr<SQLiteQueryResults> results;
  std::unique_ptr<std::optional<SQLiteQueryTableMetadata>> metadata;
};

// constexpr function that maps SQLiteColumnType to string literals
inline ColumnType mapSQLiteTypeToColumnType(const char* type) {
  if (type == NULL) {
    return ColumnType::NULL_VALUE;
  } else if (strcmp(type, "BOOLEAN")) {
    return ColumnType::BOOLEAN;
  } else if (strcmp(type, "FLOAT")) {
    return ColumnType::NUMBER;
  } else if (strcmp(type, "INTEGER")) {
    return ColumnType::INT64;
  } else if (strcmp(type, "TEXT")) {
    return ColumnType::TEXT;
  } else if (strcmp(type, "BLOB")) {
    return ColumnType::ARRAY_BUFFER;
  } else {
    return ColumnType::NULL_VALUE;
  }
}

} // namespace margelo::rnnitrosqlite
