#pragma once

#include "NitroSQLiteDatabaseConnections.hpp"
#include "hybridObjects/HybridNitroSQLiteQueryResult.hpp"
#include <functional>
#include <memory>
#include <mutex>
#include <queue>
#include <sqlite3.h>
#include <string>

namespace margelo::nitro::rnnitrosqlite {

void sqliteOpenDb(const std::string& dbName, const std::string& docPath, bool readOnly = false);

std::string sqliteOpenConnection(const std::string& dbName, const std::string& docPath, bool readOnly = false);

class SQLitePreparedStatement {
public:
  ~SQLitePreparedStatement();

  std::shared_ptr<HybridNitroSQLiteQueryResult> execute(const std::optional<SQLiteQueryParams>& params);
  void finalize();
  bool isFinalized() const;
  size_t getExternalMemorySize() const noexcept;

private:
  struct State;

  explicit SQLitePreparedStatement(std::shared_ptr<State> state);

  std::shared_ptr<State> _state;

  friend std::shared_ptr<SQLitePreparedStatement> sqlitePrepare(const std::string& dbName, const std::string& query);
};

void sqliteCloseDb(const std::string& dbName);

void sqliteRemoveDb(const std::string& dbName, const std::string& docPath, const std::optional<std::string>& connectionId = std::nullopt,
                    const std::optional<std::string>& otherDocPath = std::nullopt);

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

std::shared_ptr<SQLitePreparedStatement> sqlitePrepare(const std::string& dbName, const std::string& query);

void sqliteCloseAll();

} // namespace margelo::nitro::rnnitrosqlite
