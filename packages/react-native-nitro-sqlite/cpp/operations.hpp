#pragma once

#include "hybridObjects/HybridNitroSQLiteQueryResult.hpp"
#include "types.hpp"
#include <map>
#include <memory>
#include <mutex>
#include <sqlite3.h>
#include <string>

namespace margelo::rnnitrosqlite {

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

// Each NitroSQLite root owns its connections. Destroying an old root must not
// close or retarget connections opened by a newer JavaScript runtime.
class SQLiteDatabaseConnections final {
public:
  ~SQLiteDatabaseConnections();

  void open(const std::string& dbName, const std::string& docPath);
  void close(const std::string& dbName);
  void remove(const std::string& dbName, const std::string& docPath);
  void attach(const std::string& mainDBName, const std::string& docPath, const std::string& databaseToAttach, const std::string& alias);
  void detach(const std::string& mainDBName, const std::string& alias);
  SQLiteConnectionPtr get(const std::string& dbName);

private:
  void closeAll();

  std::map<std::string, SQLiteConnectionPtr> dbMap;
  std::mutex dbMapMutex;
  std::mutex dbLifecycleMutex;
};

std::shared_ptr<HybridNitroSQLiteQueryResult> sqliteExecute(const SQLiteConnectionPtr& connection, const std::string& query,
                                                            const std::optional<SQLiteQueryParams>& params);

SQLiteOperationResult sqliteExecuteCommand(const SQLiteConnectionPtr& connection, const std::string& query,
                                           const std::optional<SQLiteQueryParams>& params = std::nullopt);

} // namespace margelo::rnnitrosqlite
