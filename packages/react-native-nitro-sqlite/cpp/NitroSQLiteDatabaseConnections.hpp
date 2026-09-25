#pragma once

#include <filesystem>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <queue>
#include "sqlite/sqlite3.h"
#include <string>

namespace margelo::nitro::rnnitrosqlite {

/** One native SQLite handle, its file identity, and its operation locks. */
struct SQLiteConnection final : std::enable_shared_from_this<SQLiteConnection> {
  SQLiteConnection(std::string name, std::filesystem::path physicalPath, bool readOnly, sqlite3* database);
  ~SQLiteConnection();

  SQLiteConnection(const SQLiteConnection&) = delete;
  SQLiteConnection& operator=(const SQLiteConnection&) = delete;

  /** Close the native handle. References to this connection may remain alive. */
  void close() noexcept;
  /** Submit an operation to this connection's native FIFO worker. */
  void enqueueAsync(std::function<void()> operation);

  const std::string name;
  const std::filesystem::path physicalPath;
  const bool readOnly;
  sqlite3* database;
  std::recursive_mutex mutex;

private:
  void drainAsync();

  std::mutex asyncQueueMutex;
  std::queue<std::function<void()>> asyncQueue;
  bool asyncWorkerRunning = false;
};

/** Shared ownership of a native connection across pending operations. */
using SQLiteConnectionPtr = std::shared_ptr<SQLiteConnection>;

/** Registry of default database names and opaque independent connection IDs. */
class DatabaseConnections final {
public:
  // Callers hold this while resolving or migrating a database path. It is recursive because
  // open, attach and drop take it again after path resolution.
  std::recursive_mutex lifecycleMutex;

  /** Open a name-based default connection. An existing key is an error. */
  void open(const std::string& key, const std::filesystem::path& path, bool readOnly);
  /** Open a separate handle to @p path and return its opaque connection ID. */
  std::string openIndependent(const std::filesystem::path& path, bool readOnly);
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
  /** Find an open connection using either candidate path. */
  std::optional<std::filesystem::path> findLivePath(const std::filesystem::path& first, const std::filesystem::path& second);
  /** Run @p action while holding the lifecycle and every connection lock. */
  void withConnectionsLocked(const std::function<void()>& action);
  /** Delete a database after checking that no other connection or attachment uses it. */
  void drop(const std::string& dbName, const std::filesystem::path& path, const std::optional<std::string>& connectionId,
            const std::optional<std::filesystem::path>& otherPath = std::nullopt);

private:
  void openKey(const std::string& key, const std::filesystem::path& path, bool readOnly);
  bool isPathInUse(const std::filesystem::path& path, const std::string& excludedKey) const;

  std::map<std::string, SQLiteConnectionPtr> connections;
  unsigned long long nextConnectionId = 0;
};

DatabaseConnections& databaseConnections();
std::filesystem::path canonicalDatabasePath(const std::filesystem::path& path);
void validateDatabaseName(const std::string& dbName);

} // namespace margelo::nitro::rnnitrosqlite
