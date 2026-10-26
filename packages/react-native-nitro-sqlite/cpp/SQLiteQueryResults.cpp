#include "SQLiteQueryResults.hpp"
#include "SQLiteException.hpp"
#include "SQLiteJSON.hpp"
#include "sqlite/sqlite3.h"
#include <algorithm>
#include <string_view>

namespace margelo::nitro::rnnitrosqlite {

namespace {
  std::string_view readText(sqlite3_stmt* statement, int columnIndex);
  SQLiteValue readNativeColumn(sqlite3_stmt* statement, int columnIndex);
} // namespace

SQLiteQueryResults::SQLiteQueryResults() : data(std::make_shared<const SQLiteQueryResultData>()) {}

SQLiteQueryResults::SQLiteQueryResults(SQLiteQueryResultData result)
    : data(std::make_shared<const SQLiteQueryResultData>(std::move(result))) {}

SQLiteQueryResultBuilder::SQLiteQueryResultBuilder(std::vector<std::string> columnNames) : _columnNames(std::move(columnNames)) {
  _keys.reserve(_columnNames.size());
  for (const auto& name : _columnNames) {
    std::string key;
    if (!appendJSONString(key, name)) {
      // Preserve JSI's column-name conversion when a database contains malformed UTF-8 names.
      _data = SQLiteNativeQueryResults{_columnNames, {}};
      return;
    }
    key.push_back(':');
    _keys.push_back(std::move(key));
  }
  std::get<SQLiteJSONQueryResults>(_data).json.stringRepresentation = "[";
}

void SQLiteQueryResultBuilder::appendRow(sqlite3_stmt* statement) {
  if (auto* native = std::get_if<SQLiteNativeQueryResults>(&_data)) {
    SQLiteQueryResultRow row;
    row.reserve(_columnNames.size());
    for (size_t columnIndex = 0; columnIndex < _columnNames.size(); columnIndex++) {
      row.push_back(readNativeColumn(statement, static_cast<int>(columnIndex)));
    }
    native->rows.push_back(std::move(row));
    _rowCount++;
    return;
  }

  auto& json = std::get<SQLiteJSONQueryResults>(_data).json.stringRepresentation;
  if (_rowCount != 0)
    json.push_back(',');
  json.push_back('{');
  for (size_t columnIndex = 0; columnIndex < _columnNames.size(); columnIndex++) {
    if (columnIndex != 0)
      json.push_back(',');
    json.append(_keys[columnIndex]);
    const int index = static_cast<int>(columnIndex);
    switch (sqlite3_column_type(statement, index)) {
      case SQLITE_INTEGER:
        appendJSONInteger(json, sqlite3_column_int64(statement, index));
        break;
      case SQLITE_FLOAT: {
        const double value = sqlite3_column_double(statement, index);
        if (!appendJSONNumber(json, value))
          appendPatch(columnIndex, value);
        break;
      }
      case SQLITE_TEXT: {
        const auto text = readText(statement, index);
        const auto start = json.size();
        if (!appendJSONString(json, text)) {
          json.resize(start);
          appendPatch(columnIndex, std::string(text));
        }
        break;
      }
      case SQLITE_BLOB:
        appendPatch(columnIndex, readNativeColumn(statement, index));
        break;
      case SQLITE_NULL:
      default:
        json.append("null");
        break;
    }
  }
  json.push_back('}');
  _rowCount++;
}

SQLiteQueryResults SQLiteQueryResultBuilder::takeRows() {
  const bool native = std::holds_alternative<SQLiteNativeQueryResults>(_data);
  if (!native)
    std::get<SQLiteJSONQueryResults>(_data).json.stringRepresentation.push_back(']');
  SQLiteQueryResults result(std::move(_data));
  if (native)
    _data = SQLiteNativeQueryResults{_columnNames, {}};
  else
    _data = SQLiteJSONQueryResults{AnyJSON{"["}, {}};
  _rowCount = 0;
  return result;
}

void SQLiteQueryResultBuilder::appendPatch(size_t columnIndex, SQLiteValue value) {
  auto& encoded = std::get<SQLiteJSONQueryResults>(_data);
  encoded.json.stringRepresentation.append("null");
  // A later column with the same alias wins, including over a BLOB or infinity.
  if (std::find(_columnNames.begin() + columnIndex + 1, _columnNames.end(), _columnNames[columnIndex]) == _columnNames.end()) {
    encoded.patches.push_back({_rowCount, _columnNames[columnIndex], std::move(value)});
  }
}

namespace {
  std::string_view readText(sqlite3_stmt* statement, int columnIndex) {
    const auto* text = reinterpret_cast<const char*>(sqlite3_column_text(statement, columnIndex));
    if (text == nullptr)
      throw SQLiteException::SqlExecution(sqlite3_errmsg(sqlite3_db_handle(statement)));
    return {text, static_cast<size_t>(sqlite3_column_bytes(statement, columnIndex))};
  }

  SQLiteValue readNativeColumn(sqlite3_stmt* statement, int columnIndex) {
    switch (sqlite3_column_type(statement, columnIndex)) {
      case SQLITE_INTEGER:
      case SQLITE_FLOAT:
        return sqlite3_column_double(statement, columnIndex);
      case SQLITE_TEXT:
        return std::string(readText(statement, columnIndex));
      case SQLITE_BLOB: {
        const int size = sqlite3_column_bytes(statement, columnIndex);
        const auto* bytes = reinterpret_cast<const uint8_t*>(sqlite3_column_blob(statement, columnIndex));
        return size > 0 ? ArrayBuffer::copy(bytes, static_cast<size_t>(size)) : ArrayBuffer::allocate(0);
      }
      case SQLITE_NULL:
      default:
        return NullType::null;
    }
  }
} // namespace

} // namespace margelo::nitro::rnnitrosqlite

namespace margelo::nitro {

jsi::Value JSIConverter<rnnitrosqlite::SQLiteQueryResults>::toJSI(jsi::Runtime& runtime, const rnnitrosqlite::SQLiteQueryResults& results) {
  if (const auto* native = std::get_if<rnnitrosqlite::SQLiteNativeQueryResults>(results.data.get())) {
    std::vector<jsi::PropNameID> names;
    names.reserve(native->columnNames.size());
    for (const auto& name : native->columnNames) {
      names.emplace_back(jsi::PropNameID::forUtf8(runtime, reinterpret_cast<const uint8_t*>(name.data()), name.size()));
    }
    jsi::Array array(runtime, native->rows.size());
    for (size_t rowIndex = 0; rowIndex < native->rows.size(); rowIndex++) {
      jsi::Object object(runtime);
      const auto& row = native->rows[rowIndex];
      for (size_t columnIndex = 0; columnIndex < names.size(); columnIndex++) {
        object.setProperty(runtime, names[columnIndex], JSIConverter<rnnitrosqlite::SQLiteValue>::toJSI(runtime, row[columnIndex]));
      }
      array.setValueAtIndex(runtime, rowIndex, std::move(object));
    }
    return array;
  }

  const auto& data = std::get<rnnitrosqlite::SQLiteJSONQueryResults>(*results.data);
  auto converted = JSIConverter<AnyJSON>::toJSI(runtime, data.json);
  if (data.patches.empty())
    return converted;

  auto array = converted.getObject(runtime).getArray(runtime);
  for (const auto& patch : data.patches) {
    auto row = array.getValueAtIndex(runtime, patch.rowIndex).getObject(runtime);
    auto name = jsi::PropNameID::forUtf8(runtime, patch.columnName);
    row.setProperty(runtime, name, JSIConverter<rnnitrosqlite::SQLiteValue>::toJSI(runtime, patch.value));
  }
  return converted;
}

} // namespace margelo::nitro
