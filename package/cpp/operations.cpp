#include "operations.hpp"
#include "logs.hpp"
#include "utils.hpp"
#include <NitroModules/ArrayBuffer.hpp>
#include <cmath>
#include <ctime>
#include <iostream>
#include <map>
#include <sqlite3.h>
#include <sstream>
#include <unistd.h>
#include "NitroSQLiteException.hpp"

using namespace facebook;
using namespace margelo::nitro;
using namespace margelo::nitro::rnnitrosqlite;

namespace margelo::rnnitrosqlite {

std::map<std::string, sqlite3*> dbMap = std::map<std::string, sqlite3*>();

void sqliteOpenDb(const std::string& dbName, const std::string& docPath) {
  std::string dbPath = get_db_path(dbName, docPath);

  int sqlOpenFlags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX;

  sqlite3* db;
  int exit = 0;
  exit = sqlite3_open_v2(dbPath.c_str(), &db, sqlOpenFlags, nullptr);

  if (exit != SQLITE_OK) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::DatabaseCannotBeOpened, sqlite3_errmsg(db));
  } else {
    dbMap[dbName] = db;
  }
}

void sqliteCloseDb(const std::string& dbName) {

  if (dbMap.count(dbName) == 0) {
    throw NitroSQLiteException::DatabaseNotOpen(dbName);
  }

  sqlite3* db = dbMap[dbName];

  sqlite3_close_v2(db);

  dbMap.erase(dbName);
}

void sqliteCloseAll() {
  for (auto const& x : dbMap) {
    // In certain cases, this will return SQLITE_OK, mark the database connection as an unusable "zombie",
    // and deallocate the connection later.
    sqlite3_close_v2(x.second);
  }
  dbMap.clear();
}

void sqliteAttachDb(const std::string& mainDBName, const std::string& docPath, const std::string& databaseToAttach,
                              const std::string& alias) {
  /**
   * There is no need to check if mainDBName is opened because sqliteExecuteLiteral will do that.
   * */
  std::string dbPath = get_db_path(databaseToAttach, docPath);
  std::string statement = "ATTACH DATABASE '" + dbPath + "' AS " + alias;

  try {
    sqliteExecuteLiteral(mainDBName, statement);
  } catch (NitroSQLiteException& e) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::UnableToAttachToDatabase, mainDBName + " was unable to attach another database: " + std::string(e.what()));
  }
}

void sqliteDetachDb(const std::string& mainDBName, const std::string& alias) {
  /**
   * There is no need to check if mainDBName is opened because sqliteExecuteLiteral will do that.
   * */
  std::string statement = "DETACH DATABASE " + alias;

  try {
    sqliteExecuteLiteral(mainDBName, statement);
  } catch (NitroSQLiteException& e) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::UnableToAttachToDatabase, mainDBName + " was unable to detach database: " + std::string(e.what()));
  }
}

void sqliteRemoveDb(const std::string& dbName, const std::string& docPath) {
  if (dbMap.count(dbName) == 1) {
    sqliteCloseDb(dbName);
  }

  std::string dbFilePath = get_db_path(dbName, docPath);
  if (!file_exists(dbFilePath)) {
    throw NitroSQLiteException::DatabaseFileNotFound(dbFilePath);
  }

  remove(dbFilePath.c_str());
}

void bindStatement(sqlite3_stmt* statement, const SQLiteQueryParams& values) {
  for (int valueIndex = 0; valueIndex < values.size(); valueIndex++) {
    int sqliteIndex = valueIndex+1;
    SQLiteValue value = values.at(valueIndex);
    // if (std::holds_alternative<std::monostate>(value))
    // {
    //     sqlite3_bind_null(statement, sqliteIndex);
    // }
    if (std::holds_alternative<bool>(value)) {
      sqlite3_bind_int(statement, sqliteIndex, std::get<bool>(value));
    } else if (std::holds_alternative<double>(value)) {
      sqlite3_bind_double(statement, sqliteIndex, std::get<double>(value));
    } else if (std::holds_alternative<int64_t>(value)) {
      sqlite3_bind_int64(statement, sqliteIndex, std::get<int64_t>(value));
    } else if (std::holds_alternative<std::string>(value)) {
      const auto stringValue = std::get<std::string>(value);
      sqlite3_bind_text(statement, sqliteIndex, stringValue.c_str(), stringValue.length(), SQLITE_TRANSIENT);
    } else if (std::holds_alternative<std::shared_ptr<ArrayBuffer>>(value)) {
      const auto arrayBufferValue = std::get<std::shared_ptr<ArrayBuffer>>(value);
      sqlite3_bind_blob(statement, sqliteIndex, arrayBufferValue->data(), arrayBufferValue->size(), SQLITE_STATIC);
    }
  }
}

SQLiteExecuteQueryResult sqliteExecute(const std::string& dbName, const std::string& query, const std::optional<SQLiteQueryParams>& params) {
  if (dbMap.count(dbName) == 0) {
    throw NitroSQLiteException::DatabaseNotOpen(dbName);
  }

  auto db = dbMap[dbName];

  sqlite3_stmt* statement;
  int statementStatus = sqlite3_prepare_v2(db, query.c_str(), -1, &statement, NULL);
  if (statementStatus == SQLITE_OK) // statement is correct, bind the passed parameters
  {
    if (params) {
      bindStatement(statement, *params);
    }
  } else {
    throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(db));
  }

  auto isConsuming = true;
  auto isFailed = false;

  int result, i, count, column_type;
  std::string column_name;
  ColumnType column_declared_type;
  SQLiteQueryResultRow row;
  auto results = std::make_unique<SQLiteQueryResults>();
  auto metadata = new SQLiteQueryTableMetadata();

  while (isConsuming) {
    result = sqlite3_step(statement);

    switch (result) {
      case SQLITE_ROW:
        i = 0;
        row = std::unordered_map<std::string, SQLiteValue>();
        count = sqlite3_column_count(statement);

        while (i < count) {
          column_type = sqlite3_column_type(statement, i);
          column_name = sqlite3_column_name(statement, i);
          switch (column_type) {

            case SQLITE_INTEGER: {
              auto column_value = sqlite3_column_int64(statement, i);
              row[column_name] = column_value;
              break;
            }
            case SQLITE_FLOAT: {
              auto column_value = sqlite3_column_double(statement, i);
              row[column_name] = column_value;
              break;
            }
            case SQLITE_TEXT: {
              auto column_value = reinterpret_cast<const char*>(sqlite3_column_text(statement, i));
              sqlite3_column_bytes(statement, i);
              row[column_name] = column_value;
              break;
            }
            case SQLITE_BLOB: {
              int blob_size = sqlite3_column_bytes(statement, i);
              const void* blob = sqlite3_column_blob(statement, i);
              uint8_t* data = new uint8_t[blob_size];
              memcpy(data, blob, blob_size);
              row[column_name] = ArrayBuffer::makeBuffer(data, blob_size, [&data]() -> void { delete[] data; });
              break;
            }
            case SQLITE_NULL:
              // Intentionally left blank to switch to default case
            default:
              //                            row[column_name] = std::monostate();
              break;
          }
          i++;
        }
        results->push_back(std::move(row));
        break;
      case SQLITE_DONE:
          i = 0;
          count = sqlite3_column_count(statement);
          while (i < count) {
            column_name = sqlite3_column_name(statement, i);
            const char* tp = sqlite3_column_decltype(statement, i);
            column_declared_type = mapSQLiteTypeToColumnType(tp);
            auto columnMeta = SQLiteQueryColumnMetadata(std::move(column_name), std::move(column_declared_type), i);
            metadata->insert({column_name, columnMeta});
            i++;
          }
          isConsuming = false;
        break;
      default:
        isFailed = true;
        isConsuming = false;
    }
  }

  sqlite3_finalize(statement);

  if (isFailed) {
    throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(db));
  }

  int rowsAffected = sqlite3_changes(db);
  long long latestInsertRowId = sqlite3_last_insert_rowid(db);
  auto meta = std::make_unique<std::optional<SQLiteQueryTableMetadata>>(
    metadata && metadata->size() > 0
    ? std::make_optional(std::move(*metadata))
    : std::nullopt
  );
  return {
    .rowsAffected = rowsAffected,
    .insertId = static_cast<double>(latestInsertRowId),
    .results = std::move(results),
    .metadata = std::move(meta)
  };
}

SQLiteOperationResult sqliteExecuteLiteral(const std::string& dbName, const std::string& query) {
  // Check if db connection is opened
  if (dbMap.count(dbName) == 0) {
    throw NitroSQLiteException::DatabaseNotOpen(dbName);
  }

  sqlite3* db = dbMap[dbName];

  // SQLite statements need to be compiled before executed
  sqlite3_stmt* statement;

  // Compile and move result into statement memory spot
  int statementStatus = sqlite3_prepare_v2(db, query.c_str(), -1, &statement, NULL);

  if (statementStatus != SQLITE_OK) // statemnet is correct, bind the passed parameters
  {
    throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(db));
  }

  bool isConsuming = true;
  bool isFailed = false;

  int result, i, count, column_type;
  std::string column_name;

  while (isConsuming) {
    result = sqlite3_step(statement);

    switch (result) {
      case SQLITE_ROW:
        isConsuming = true;
        break;

      case SQLITE_DONE:
        isConsuming = false;
        break;

      default:
        isFailed = true;
        isConsuming = false;
    }
  }

  sqlite3_finalize(statement);

  if (isFailed) {
    throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(db));
  }

  return {.rowsAffected = sqlite3_changes(db)};
}

} // namespace margelo::rnnitrosqlite
