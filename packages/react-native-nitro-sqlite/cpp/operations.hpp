#pragma once

#include "hybridObjects/HybridNitroSQLiteQueryResult.hpp"
#include "types.hpp"
#include <memory>
#include <mutex>
#include <sqlite3.h>
#include <string>

namespace margelo::nitro::rnnitrosqlite {

// Calls against one connection are serialized by `mutex`. Separate connections
// intentionally remain independent, so SQLITE_THREADSAFE=0 still requires the
// caller to serialize SQLite calls globally.
struct SQLiteConnection final {
  SQLiteConnection(std::string name, sqlite3* database);
  ~SQLiteConnection();

  SQLiteConnection(const SQLiteConnection&) = delete;
  SQLiteConnection& operator=(const SQLiteConnection&) = delete;

  void close() noexcept;

  const std::string name;
  sqlite3* database;
  std::recursive_mutex mutex;
};

using SQLiteConnectionPtr = std::shared_ptr<SQLiteConnection>;

void sqliteOpenDb(const std::string& dbName, const std::string& docPath);

void sqliteCloseDb(const std::string& dbName);

void sqliteRemoveDb(const std::string& dbName, const std::string& docPath);

void sqliteAttachDb(const std::string& mainDBName, const std::string& docPath, const std::string& databaseToAttach,
                    const std::string& alias);

void sqliteDetachDb(const std::string& mainDBName, const std::string& alias);

SQLiteConnectionPtr sqliteGetOpenDatabase(const std::string& dbName);

std::shared_ptr<HybridNitroSQLiteQueryResult> sqliteExecute(const std::string& dbName, const std::string& query,
                                                            const std::optional<SQLiteQueryParams>& params);
std::shared_ptr<HybridNitroSQLiteQueryResult> sqliteExecute(const SQLiteConnectionPtr& connection, const std::string& query,
                                                            const std::optional<SQLiteQueryParams>& params);

SQLiteOperationResult sqliteExecuteCommand(const std::string& dbName, const std::string& query,
                                           const std::optional<SQLiteQueryParams>& params = std::nullopt);
SQLiteOperationResult sqliteExecuteCommand(const SQLiteConnectionPtr& connection, const std::string& query,
                                           const std::optional<SQLiteQueryParams>& params = std::nullopt);

void sqliteCloseAll();

} // namespace margelo::nitro::rnnitrosqlite
