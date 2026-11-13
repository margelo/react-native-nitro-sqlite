#pragma once

#include "SQLiteTypes.hpp"
#include <NitroModules/AnyJSON.hpp>
#include <NitroModules/JSIConverter.hpp>
#include <functional>
#include <jsi/jsi.h>
#include <memory>
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

using SQLiteQueryResultData = std::variant<SQLiteJSONQueryResults, SQLiteNativeQueryResults>;

// JSON is encoded on the SQLite thread. BLOBs and non-finite numbers retain their native values.
struct SQLiteQueryResults {
  SQLiteQueryResults();
  explicit SQLiteQueryResults(SQLiteQueryResultData result);

  std::shared_ptr<const SQLiteQueryResultData> data;
};

/** Encodes SQLite rows as they are read, keeping only values JSON cannot represent in native storage. */
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
  void appendPatch(size_t columnIndex, SQLiteValue value);

  std::vector<std::string> _columnNames;
  std::vector<std::string> _keys;
  SQLiteQueryResultData _data;
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
