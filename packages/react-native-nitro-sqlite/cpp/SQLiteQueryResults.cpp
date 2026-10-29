#include "SQLiteQueryResults.hpp"
#include "SQLiteException.hpp"
#include "SQLiteJSON.hpp"
#include "sqlite/sqlite3.h"
#include <algorithm>
#include <string_view>

namespace margelo::nitro::rnnitrosqlite {

namespace {
  // Parsing JSON has a fixed cost per batch, so batches up to this many cells convert faster through direct JSI calls.
  constexpr size_t kNativeCellLimit = 32;

  std::string_view readText(sqlite3_stmt* statement, int columnIndex);
  SQLiteValue readNativeColumn(sqlite3_stmt* statement, int columnIndex);
} // namespace

SQLiteQueryResults::SQLiteQueryResults() : data(std::make_shared<const SQLiteQueryResultData>()) {}

SQLiteQueryResults::SQLiteQueryResults(SQLiteQueryResultData result)
    : data(std::make_shared<const SQLiteQueryResultData>(std::move(result))) {}

SQLiteQueryResultBuilder::SQLiteQueryResultBuilder(std::vector<std::string> columnNames) : _columnNames(std::move(columnNames)) {}

void SQLiteQueryResultBuilder::appendRow(sqlite3_stmt* statement) {
  const bool fitsNativeBatch = (_rowCount + 1) * _columnNames.size() <= kNativeCellLimit;
  if (!_json && (fitsNativeBatch || !startJSON())) {
    appendNativeRow(statement);
    return;
  }
  appendJSONRow(statement);
}

SQLiteQueryResults SQLiteQueryResultBuilder::takeRows() {
  _rowCount = 0;
  if (!_json) {
    return SQLiteQueryResults(SQLiteNativeQueryResults{_columnNames, std::exchange(_nativeRows, {})});
  }

  auto& json = _json->json.stringRepresentation;
  json.push_back(']');
  // Later batches of a streamed result are about as large, so reserve their JSON instead of regrowing it.
  _jsonCapacity = json.size();
  SQLiteQueryResults result(std::move(*_json));
  _json.reset();
  return result;
}

// Switch the current batch to JSON, encoding the rows it has kept natively so far.
bool SQLiteQueryResultBuilder::startJSON() {
  if (_hasMalformedColumnName)
    return false;
  if (_keys.empty()) {
    _keys.reserve(_columnNames.size());
    for (const auto& name : _columnNames) {
      std::string key;
      if (!appendJSONString(key, name)) {
        // Keep JSI's column-name conversion when a database contains malformed UTF-8 names.
        _hasMalformedColumnName = true;
        _keys.clear();
        return false;
      }
      key.push_back(':');
      _keys.push_back(std::move(key));
    }
  }

  auto& json = _json.emplace().json.stringRepresentation;
  json.reserve(_jsonCapacity);
  json = "[";
  for (size_t rowIndex = 0; rowIndex < _nativeRows.size(); rowIndex++) {
    json.append(rowIndex == 0 ? "{" : ",{");
    auto& row = _nativeRows[rowIndex];
    for (size_t columnIndex = 0; columnIndex < row.size(); columnIndex++) {
      if (columnIndex != 0)
        json.push_back(',');
      json.append(_keys[columnIndex]);
      appendBufferedValue(rowIndex, columnIndex, std::move(row[columnIndex]));
    }
    json.push_back('}');
  }
  _nativeRows.clear();
  return true;
}

void SQLiteQueryResultBuilder::appendNativeRow(sqlite3_stmt* statement) {
  SQLiteQueryResultRow row;
  row.reserve(_columnNames.size());
  for (size_t columnIndex = 0; columnIndex < _columnNames.size(); columnIndex++) {
    row.push_back(readNativeColumn(statement, static_cast<int>(columnIndex)));
  }
  _nativeRows.push_back(std::move(row));
  _rowCount++;
}

void SQLiteQueryResultBuilder::appendJSONRow(sqlite3_stmt* statement) {
  auto& json = _json->json.stringRepresentation;
  json.append(_rowCount == 0 ? "{" : ",{");
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
          appendPatch(_rowCount, columnIndex, value);
        break;
      }
      case SQLITE_TEXT: {
        const auto text = readText(statement, index);
        const auto start = json.size();
        if (!appendJSONString(json, text)) {
          json.resize(start);
          appendPatch(_rowCount, columnIndex, std::string(text));
        }
        break;
      }
      case SQLITE_BLOB:
        appendPatch(_rowCount, columnIndex, readNativeColumn(statement, index));
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

// Encode a value from a row that was read natively before its batch switched to JSON.
void SQLiteQueryResultBuilder::appendBufferedValue(size_t rowIndex, size_t columnIndex, SQLiteValue value) {
  auto& json = _json->json.stringRepresentation;
  if (!value || std::holds_alternative<NullType>(*value)) {
    json.append("null");
    return;
  }
  const auto start = json.size();
  if (const auto* number = std::get_if<double>(&*value); number != nullptr && appendJSONNumber(json, *number))
    return;
  if (const auto* text = std::get_if<std::string>(&*value); text != nullptr && appendJSONString(json, *text))
    return;
  // BLOBs, non-finite numbers, and malformed UTF-8 keep their native values.
  json.resize(start);
  appendPatch(rowIndex, columnIndex, std::move(value));
}

void SQLiteQueryResultBuilder::appendPatch(size_t rowIndex, size_t columnIndex, SQLiteValue value) {
  _json->json.stringRepresentation.append("null");
  // A later column with the same alias wins, including over a BLOB or infinity.
  if (std::find(_columnNames.begin() + columnIndex + 1, _columnNames.end(), _columnNames[columnIndex]) == _columnNames.end()) {
    _json->patches.push_back({rowIndex, _columnNames[columnIndex], std::move(value)});
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
    if (native->rows.empty())
      return jsi::Array(runtime, 0);
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
