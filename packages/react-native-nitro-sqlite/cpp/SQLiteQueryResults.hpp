#pragma once

#include "SQLiteTypes.hpp"
#include <NitroModules/AnyJSON.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
#include <optional>
#include <stdexcept>
#include <utility>
#include <vector>

struct sqlite3_stmt;

namespace margelo::nitro::rnnitrosqlite {

using SQLiteQueryResultRow = std::vector<SQLiteValue>;

struct SQLiteQueryResultPatch {
  size_t rowIndex;
  std::string columnName;
  SQLiteValue value;
};

struct SQLiteJSONQueryResults {
  AnyJSON json{"[]"};
  std::vector<SQLiteQueryResultPatch> patches;
};

struct SQLiteNativeQueryResults {
  std::vector<std::string> columnNames;
  std::vector<SQLiteQueryResultRow> rows;
};

using SQLiteQueryResultData = std::variant<SQLiteNativeQueryResults, SQLiteJSONQueryResults>;

// Small batches keep native values. Larger batches are encoded as JSON on the SQLite thread, where BLOBs and
// non-finite numbers retain their native values.
struct SQLiteQueryResults {
  SQLiteQueryResults();
  explicit SQLiteQueryResults(SQLiteQueryResultData result);

  std::shared_ptr<const SQLiteQueryResultData> data;
};

/** Collects SQLite rows in batches for JavaScript.
 * A batch keeps native values while it is small, because parsing JSON has a fixed cost that only pays off for
 * larger results. Once it grows, the batch is encoded as JSON as rows are read, keeping only values JSON cannot
 * represent in native storage.
 */
class SQLiteQueryResultBuilder final {
public:
  /** Capture the statement's column names after SQLite has performed any automatic reprepare. */
  explicit SQLiteQueryResultBuilder(std::vector<std::string> columnNames);
  /** Copy the current row before SQLite advances the statement or releases its column buffers. */
  void appendRow(sqlite3_stmt* statement);
  /** Number of rows in the batch that has not yet been handed to JavaScript. */
  size_t size() const {
    return _rowCount;
  }
  /** Finish this batch and start an empty batch with the same columns. */
  SQLiteQueryResults takeRows();

private:
  bool startJSON();
  void appendNativeRow(sqlite3_stmt* statement);
  void appendJSONRow(sqlite3_stmt* statement);
  void appendBufferedValue(size_t rowIndex, size_t columnIndex, SQLiteValue value);
  void appendPatch(size_t rowIndex, size_t columnIndex, SQLiteValue value);

  std::vector<std::string> _columnNames;
  // Quoted column names followed by ':', built when the first batch switches to JSON.
  std::vector<std::string> _keys;
  bool _hasMalformedColumnName = false;
  std::vector<SQLiteQueryResultRow> _nativeRows;
  std::optional<SQLiteJSONQueryResults> _json;
  size_t _jsonCapacity = 0;
  size_t _rowCount = 0;
};

/** Receives leading result rows in batches while the statement still runs. */
using SQLiteRowBatchHandler = std::function<void(SQLiteQueryResults)>;

} // namespace margelo::nitro::rnnitrosqlite

namespace margelo::nitro {

template <>
struct JSIConverter<rnnitrosqlite::SQLiteQueryResults> final {
  static jsi::Value toJSI(jsi::Runtime& runtime, const rnnitrosqlite::SQLiteQueryResults& results);

  // Query results only travel from native code to JavaScript.
  static rnnitrosqlite::SQLiteQueryResults fromJSI(jsi::Runtime&, const jsi::Value&) {
    throw std::logic_error("SQLite query results cannot be passed from JavaScript");
  }

  static bool canConvert(jsi::Runtime&, const jsi::Value&) {
    return false;
  }
};

} // namespace margelo::nitro
