#pragma once

#include "ColumnType.hpp"
#include "NitroSQLiteQueryColumnMetadata.hpp"
#include <NitroModules/ArrayBuffer.hpp>
#include <string>
#include <unordered_map>
#include <variant>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

using SQLiteValue = std::variant<NullType, bool, std::shared_ptr<ArrayBuffer>, std::string, double>;
using SQLiteQueryParams = std::vector<SQLiteValue>;
using SQLiteQueryTableMetadata = std::unordered_map<std::string, NitroSQLiteQueryColumnMetadata>;

struct SQLiteOperationResult {
  int rowsAffected;
  int commands = 0;
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

} // namespace margelo::nitro::rnnitrosqlite
