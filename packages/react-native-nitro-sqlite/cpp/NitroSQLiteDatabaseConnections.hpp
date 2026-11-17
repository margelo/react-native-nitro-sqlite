#pragma once

#ifdef SQLITE_ENABLE_SEE
#define SQLITE_HAS_CODEC 1
#endif
#include "DatabaseChange.hpp"
#include "NitroSQLiteStatementCache.hpp"
#include "sqlite/sqlite3.h"
#include <atomic>
#include <filesystem>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

/** Runs operations in FIFO order on one dedicated thread. */
class SerialWorker final {
public:
  /** Start the thread. @p name identifies the worker in error logs. */
  explicit SerialWorker(std::string name);
  /** Run the remaining operations, then stop the thread. */
  ~SerialWorker();

  SerialWorker(const SerialWorker&) = delete;
  SerialWorker& operator=(const SerialWorker&) = delete;

  /** Queue an operation. Exceptions it throws are logged and dropped. */
  void enqueue(std::function<void()> operation);

private:
  struct State;

  std::shared_ptr<State> _state;
  std::thread _thread;
};

/** Receives the row changes of one committed transaction. */
using SQLiteChangeHandler = std::function<void(const std::vector<DatabaseChange>&)>;

/** One native SQLite handle, its file identity, and its operation locks. */
struct SQLiteConnection final {
  SQLiteConnection(std::string name, std::filesystem::path physicalPath, bool readOnly, sqlite3* database);
  ~SQLiteConnection();

  SQLiteConnection(const SQLiteConnection&) = delete;
  SQLiteConnection& operator=(const SQLiteConnection&) = delete;

  /** Close the native handle. References to this connection may remain alive. */
  void close() noexcept;
  /** Submit an operation to this connection's native FIFO worker. */
  void enqueueAsync(std::function<void()> operation);
  /** Send committed row changes to @p handler, or stop recording them with std::nullopt.
   * Does not wait for the connection's running operation.
   */
  void setChangeHandler(std::optional<SQLiteChangeHandler> handler);
  /** Send the recorded changes to the change handler if no transaction is open. Requires mutex. */
  void deliverCommittedChanges() noexcept;

  const std::string name;
  const std::filesystem::path physicalPath;
  const bool readOnly;
  sqlite3* database;
  std::recursive_mutex mutex;
  /** Reusable statements for repeated SQL. Guarded by mutex and cleared on close. */
  SQLiteStatementCache statementCache;
  /** Changes recorded by SQLite's update hook since the last commit or rollback. Guarded by mutex,
   * which every statement step holds.
   */
  std::vector<DatabaseChange> pendingChanges;
  /** Whether the update hook records changes. Set while a change handler is registered. */
  std::atomic<bool> recordsChanges = false;

private:
  // Separate from mutex so that registering a handler never waits for a running query.
  std::mutex changeHandlerMutex;
  std::optional<SQLiteChangeHandler> changeHandler;
  std::mutex asyncWorkerMutex;
  // Started by the first async operation. One dedicated thread, rather than a shared pool that
  // spreads operations across its threads, lets the OS scheduler see the connection's sustained load.
  std::unique_ptr<SerialWorker> asyncWorker;
};

/** Covers one SQL execution on a connection whose mutex the caller holds. When it ends with no
 * transaction open, it sends the recorded changes to the change handler. When it ends with an
 * exception, it first drops the changes recorded during the execution, because SQLite rolled back
 * the failed statement.
 */
class SQLiteChangeScope final {
public:
  explicit SQLiteChangeScope(SQLiteConnection& connection) noexcept;
  ~SQLiteChangeScope();

  SQLiteChangeScope(const SQLiteChangeScope&) = delete;
  SQLiteChangeScope& operator=(const SQLiteChangeScope&) = delete;

private:
  SQLiteConnection& _connection;
  const size_t _recordedChanges;
  const int _uncaughtExceptions;
};

/** Shared ownership of a native connection across pending operations. */
using SQLiteConnectionPtr = std::shared_ptr<SQLiteConnection>;

/** Connections owned by one NitroSQLite root. Destruction closes only this owner's handles. */
class DatabaseConnections final {
public:
  DatabaseConnections();
  ~DatabaseConnections();

  DatabaseConnections(const DatabaseConnections&) = delete;
  DatabaseConnections& operator=(const DatabaseConnections&) = delete;

  // Callers hold this while resolving or migrating a database path. It is recursive because
  // open, attach and drop take it again after path resolution. Shared across roots to protect files.
  std::recursive_mutex& lifecycleMutex;

  /** Open a name-based default connection. An existing key is an error. */
  void open(const std::string& key, const std::filesystem::path& path, bool readOnly,
            const std::optional<std::string>& encryptionKey = std::nullopt);
  /** Open a separate handle to @p path and return its opaque connection ID. */
  std::string openIndependent(const std::filesystem::path& path, bool readOnly,
                              const std::optional<std::string>& encryptionKey = std::nullopt);
  /** Close the handle identified by a default name or independent ID. */
  void close(const std::string& key);
  /** Close all registered handles. */
  void closeAll();
  /** Return a live connection or throw if @p key is unknown. */
  SQLiteConnectionPtr get(const std::string& key);
  /** Check whether @p key still identifies an open connection. */
  bool isOpen(const std::string& key);
  /** Resolve the file path for a registered or encoded independent key. */
  std::optional<std::filesystem::path> physicalPathForKey(const std::string& key);
  /** Find an open connection in any owner using either candidate path. */
  std::optional<std::filesystem::path> findLivePath(const std::filesystem::path& first, const std::filesystem::path& second);
  /** Run an internal file operation while holding the lifecycle and all owners' connection locks. */
  void withConnectionsLocked(const std::function<void()>& action);
  /** Delete a database after checking that no other connection or attachment uses it. */
  void drop(const std::string& dbName, const std::filesystem::path& path, const std::optional<std::string>& connectionId,
            const std::optional<std::filesystem::path>& otherPath = std::nullopt);

private:
  void openKey(const std::string& key, const std::filesystem::path& path, bool readOnly, const std::optional<std::string>& encryptionKey);
  bool isPathInUse(const std::filesystem::path& path, const SQLiteConnectionPtr& excludedConnection) const;

  std::map<std::string, SQLiteConnectionPtr> connections;
};

std::filesystem::path canonicalDatabasePath(const std::filesystem::path& path);
void validateDatabaseName(const std::string& dbName);

} // namespace margelo::nitro::rnnitrosqlite
