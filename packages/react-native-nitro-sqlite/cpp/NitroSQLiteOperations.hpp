#pragma once

#include "NitroSQLiteDatabaseConnections.hpp"
#include "NitroSQLiteQueryResult.hpp"
#include "sqlite/sqlite3.h"
#include <functional>
#include <memory>
#include <mutex>
#include <queue>
#include <string>

namespace margelo::nitro::rnnitrosqlite {

/** Open the default connection by database name. Read-only mode requires an existing file. */
void sqliteOpenDb(DatabaseConnections& connections, const std::string& dbName, const std::string& docPath, bool readOnly,
                  const std::optional<std::string>& encryptionKey);

/** Open a separate native handle and return its opaque connection ID. */
std::string sqliteOpenConnection(DatabaseConnections& connections, const std::string& dbName, const std::string& docPath, bool readOnly,
                                 const std::optional<std::string>& encryptionKey);

/** Prepared SQL statement bound to one native connection. */
class SQLitePreparedStatement {
public:
  ~SQLitePreparedStatement();

  /** Reset and execute with new bindings. Throws after finalization or connection closure. */
  NitroSQLiteQueryResult execute(const std::optional<SQLiteQueryParams>& params);
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

  friend std::shared_ptr<SQLitePreparedStatement> sqlitePrepare(const SQLiteConnectionPtr& connection, const std::string& query);
};

/** Delete a database, optionally closing its independent connection first. */
void sqliteRemoveDb(DatabaseConnections& connections, const std::string& dbName, const std::string& docPath,
                    const std::optional<std::string>& connectionId = std::nullopt,
                    const std::optional<std::string>& otherDocPath = std::nullopt);

void sqliteAttachDb(const SQLiteConnectionPtr& connection, const std::string& docPath, const std::string& databaseToAttach,
                    const std::string& alias);

void sqliteDetachDb(const SQLiteConnectionPtr& connection, const std::string& alias);

/** Execute one statement. With @p onRows, full batches of rows go to it as they are read and the
 * returned result holds only the rows after the last batch.
 */
NitroSQLiteQueryResult sqliteExecute(const SQLiteConnectionPtr& connection, const std::string& query,
                                     const std::optional<SQLiteQueryParams>& params, const SQLiteRowBatchHandler& onRows = nullptr);

SQLiteOperationResult sqliteExecuteCommand(const SQLiteConnectionPtr& connection, const std::string& query,
                                           const std::optional<SQLiteQueryParams>& params = std::nullopt);

/** Execute one SQL statement for each parameter set, preparing it once. */
SQLiteOperationResult sqliteExecuteCommandGroup(const SQLiteConnectionPtr& connection, const std::string& query,
                                                const std::vector<SQLiteQueryParams>& parameterSets);

/** Prepare one SQL statement on an open default or independent connection. */
std::shared_ptr<SQLitePreparedStatement> sqlitePrepare(const SQLiteConnectionPtr& connection, const std::string& query);

} // namespace margelo::nitro::rnnitrosqlite
