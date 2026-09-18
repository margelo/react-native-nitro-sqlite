#pragma once

#include <filesystem>
#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <sqlite3.h>
#include <string>

namespace margelo::rnnitrosqlite {

struct SQLiteConnection final {
  SQLiteConnection(std::string name, std::filesystem::path physicalPath, bool readOnly, sqlite3* database);
  ~SQLiteConnection();

  SQLiteConnection(const SQLiteConnection&) = delete;
  SQLiteConnection& operator=(const SQLiteConnection&) = delete;

  void close() noexcept;

  const std::string name;
  const std::filesystem::path physicalPath;
  const bool readOnly;
  sqlite3* database;
  std::recursive_mutex mutex;
};

using SQLiteConnectionPtr = std::shared_ptr<SQLiteConnection>;

class DatabaseConnections final {
public:
  // Callers hold this while resolving or migrating a database path. It is recursive because
  // open, attach and drop take it again after path resolution.
  std::recursive_mutex lifecycleMutex;

  void open(const std::string& key, const std::filesystem::path& path, bool readOnly);
  std::string openIndependent(const std::filesystem::path& path, bool readOnly);
  void close(const std::string& key);
  void closeAll();
  SQLiteConnectionPtr get(const std::string& key);
  bool isOpen(const std::string& key);
  std::optional<std::filesystem::path> physicalPathForKey(const std::string& key);
  std::optional<std::filesystem::path> findLivePath(const std::filesystem::path& first, const std::filesystem::path& second);
  void withConnectionsLocked(const std::function<void()>& action);
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

} // namespace margelo::rnnitrosqlite
