#pragma once

#include "NitroSQLiteTypes.hpp"
#include <NitroModules/JSIConverter+ArrayBuffer.hpp>
#include <NitroModules/JSIConverter+Variant.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <jsi/jsi.h>
#include <memory>
#include <stdexcept>
#include <utility>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

using SQLiteQueryResultRow = std::vector<SQLiteValue>;

struct SQLiteQueryResultData {
  std::vector<std::string> columnNames;
  std::vector<SQLiteQueryResultRow> rows;
};

// The getter returns this small value. Its shared storage remains owned by the
// HybridObject, so repeated reads produce independent JavaScript arrays.
struct SQLiteQueryResults {
  SQLiteQueryResults() : data(std::make_shared<const SQLiteQueryResultData>()) {}
  SQLiteQueryResults(std::vector<std::string> columnNames, std::vector<SQLiteQueryResultRow> rows)
      : data(std::make_shared<const SQLiteQueryResultData>(std::move(columnNames), std::move(rows))) {}

  std::shared_ptr<const SQLiteQueryResultData> data;
};

} // namespace margelo::nitro::rnnitrosqlite

namespace margelo::nitro {

template <>
struct JSIConverter<rnnitrosqlite::SQLiteQueryResults> final {
  static jsi::Value toJSI(jsi::Runtime& runtime, const rnnitrosqlite::SQLiteQueryResults& results) {
    const auto& data = *results.data;
    std::vector<jsi::PropNameID> names;
    names.reserve(data.columnNames.size());
    for (const auto& name : data.columnNames) {
      names.emplace_back(jsi::PropNameID::forUtf8(runtime, reinterpret_cast<const uint8_t*>(name.data()), name.size()));
    }

    jsi::Array array(runtime, data.rows.size());
    for (size_t rowIndex = 0; rowIndex < data.rows.size(); rowIndex++) {
      jsi::Object object(runtime);
      const auto& row = data.rows[rowIndex];
      for (size_t columnIndex = 0; columnIndex < names.size(); columnIndex++) {
        // Repeated aliases overwrite earlier values, as the former row map did.
        object.setProperty(runtime, names[columnIndex], JSIConverter<rnnitrosqlite::SQLiteValue>::toJSI(runtime, row[columnIndex]));
      }
      array.setValueAtIndex(runtime, rowIndex, std::move(object));
    }
    return array;
  }

  // `results` is a native, read-only getter. Nitro never passes it from JS.
  static rnnitrosqlite::SQLiteQueryResults fromJSI(jsi::Runtime&, const jsi::Value&) {
    throw std::logic_error("SQLite query results cannot be passed from JavaScript");
  }

  static bool canConvert(jsi::Runtime&, const jsi::Value&) {
    return false;
  }
};

} // namespace margelo::nitro
