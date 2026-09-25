#pragma once

#include "NitroSQLiteDatabaseConnections.hpp"
#include "hybridObjects/HybridNitroSQLiteQueryResult.hpp"
#include <functional>
#include <memory>
#include <mutex>
#include <queue>
#include "sqlite/sqlite3.h"
#include <string>

namespace margelo::nitro::rnnitrosqlite {

/** Open the default connection by database name. Read-only mode requires an existing file. */
void sqliteOpenDb(const std::string& dbName, const std::string& docPath, bool readOnly = false);

/** Open a separate native handle and return its opaque connection ID. */
std::string sqliteOpenConnection(const std::string& dbName, const std::string& docPath, bool readOnly = false);

/** Prepared SQL statement bound to one native connection. */
class SQLitePreparedStatement {
public:
  ~SQLitePreparedStatement();

  /** Reset and execute with new bindings. Throws after finalization or connection closure. */
  std::shared_ptr<HybridNitroSQLiteQueryResult> execute(const std::optional<SQLiteQueryParams>& params);
  /** Release the native statement. Repeated calls are safe. */
  void finalize();
  /** Check whether the native statement has been released. */
  bool isFinalized() const;
  /** Report this object's native memory size to the Nitro runtime. */
  size_t getExternalMemorySize() const noexcept;

private:
  struct State;

  explicit SQLitePreparedStatement(std::shared_ptr<State> state);

  std::shared_ptr<State> _state;

  friend std::shared_ptr<SQLitePreparedStatement> sqlitePrepare(const std::string& dbName, const std::string& query);
};

void sqliteCloseDb(const std::string& dbName);

/** Delete a database, optionally closing its independent connection first. */
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

/** Prepare one SQL statement on an open default or independent connection. */
std::shared_ptr<SQLitePreparedStatement> sqlitePrepare(const std::string& dbName, const std::string& query);

void sqliteCloseAll();

} // namespace margelo::nitro::rnnitrosqlite
