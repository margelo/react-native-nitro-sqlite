#include "databaseConnections.hpp"
#include "NitroSQLiteException.hpp"
#include "databaseMigration.hpp"
#include <filesystem>
#include <memory>
#include <stdexcept>
#include <unordered_map>
#include <vector>

namespace margelo::rnnitrosqlite {

namespace fs = std::filesystem;

namespace {

  constexpr const char* kIndependentPrefix = "nitro-sqlite:";

  int readOnlyAuthorizer(void*, int action, const char*, const char*, const char*, const char*) {
    return action == SQLITE_ATTACH ? SQLITE_DENY : SQLITE_OK;
  }

  struct IndependentId {
    fs::path physicalPath;
    bool readOnly;
  };

  std::optional<IndependentId> parseIndependentId(const std::string& key) {
    if (key.empty() || key.front() != '\0' || key.compare(1, std::char_traits<char>::length(kIndependentPrefix), kIndependentPrefix) != 0) {
      return std::nullopt;
    }
    const auto separator = key.find('\0', 1);
    if (separator == std::string::npos || separator + 2 >= key.size()) {
      return std::nullopt;
    }
    const char mode = key[separator + 1];
    if (mode != 'r' && mode != 'w') {
      return std::nullopt;
    }
    return IndependentId{fs::path(key.substr(separator + 2)), mode == 'r'};
  }

  std::string connectionLabel(const std::string& key) {
    const auto independent = parseIndependentId(key);
    if (independent) {
      return independent->physicalPath.string();
    }
    return key.find('\0') == std::string::npos ? key : "invalid connection ID";
  }

  template <typename Predicate>
  bool anyDatabasePath(sqlite3* database, Predicate&& predicate) {
    sqlite3_stmt* rawStatement = nullptr;
    const int prepared = sqlite3_prepare_v2(database, "PRAGMA database_list", -1, &rawStatement, nullptr);
    std::unique_ptr<sqlite3_stmt, decltype(&sqlite3_finalize)> statement(rawStatement, sqlite3_finalize);
    if (prepared != SQLITE_OK) {
      throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(database));
    }
    int result;
    while ((result = sqlite3_step(statement.get())) == SQLITE_ROW) {
      const auto* rawPath = reinterpret_cast<const char*>(sqlite3_column_text(statement.get(), 2));
      if (rawPath != nullptr && rawPath[0] != '\0' && predicate(fs::path(rawPath))) {
        return true;
      }
    }
    if (result != SQLITE_DONE) {
      throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(database));
    }
    return false;
  }

  bool sameFile(const fs::path& first, const fs::path& second) {
    std::error_code error;
    if (fs::equivalent(first, second, error) && !error) {
      return true;
    }
    return canonicalDatabasePath(first) == canonicalDatabasePath(second);
  }

} // namespace

SQLiteConnection::SQLiteConnection(std::string connectionName, fs::path path, bool isReadOnly, sqlite3* handle)
    : name(std::move(connectionName)), physicalPath(canonicalDatabasePath(path)), readOnly(isReadOnly), database(handle) {}

SQLiteConnection::~SQLiteConnection() {
  close();
}

void SQLiteConnection::close() noexcept {
  std::lock_guard lock(mutex);
  if (database == nullptr) {
    return;
  }
  sqlite3_close_v2(database);
  database = nullptr;
}

void DatabaseConnections::open(const std::string& key, const fs::path& path, bool readOnly) {
  std::lock_guard lock(lifecycleMutex);
  validateDatabaseName(key);
  if (connections.contains(key)) {
    throw NitroSQLiteException::DatabaseAlreadyOpen(key);
  }
  openKey(key, path, readOnly);
}

std::string DatabaseConnections::openIndependent(const fs::path& path, bool readOnly) {
  std::lock_guard lock(lifecycleMutex);
  if (path.string().find('\0') != std::string::npos) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::DatabaseCannotBeOpened, "Database path contains a NUL byte");
  }
  if (sqlite3_threadsafe() == 0) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::DatabaseCannotBeOpened,
                               "Independent connections require a thread-safe SQLite build");
  }
  // NUL cannot occur in a filesystem name. The ID cannot collide with a legacy database key.
  const auto physicalPath = canonicalDatabasePath(path);
  const std::string key = std::string(1, '\0') + kIndependentPrefix + std::to_string(++nextConnectionId) + std::string(1, '\0') +
                          (readOnly ? "r" : "w") + physicalPath.string();
  openKey(key, path, readOnly);
  return key;
}

void DatabaseConnections::openKey(const std::string& key, const fs::path& path, bool readOnly) {
  if (path.string().find('\0') != std::string::npos) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::DatabaseCannotBeOpened, "Database path contains a NUL byte");
  }
  const auto physicalPath = canonicalDatabasePath(path);
  const int flags = (readOnly ? SQLITE_OPEN_READONLY : SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE) | SQLITE_OPEN_FULLMUTEX;
  sqlite3* rawDatabase = nullptr;
  const int result = sqlite3_open_v2(physicalPath.string().c_str(), &rawDatabase, flags, nullptr);
  std::unique_ptr<sqlite3, decltype(&sqlite3_close_v2)> database(rawDatabase, sqlite3_close_v2);
  if (result != SQLITE_OK) {
    const std::string message = rawDatabase == nullptr ? sqlite3_errstr(result) : sqlite3_errmsg(rawDatabase);
    throw NitroSQLiteException(NitroSQLiteExceptionType::DatabaseCannotBeOpened, message);
  }
  if (readOnly) {
    sqlite3_set_authorizer(database.get(), readOnlyAuthorizer, nullptr);
  }
  auto connection = std::make_shared<SQLiteConnection>(connectionLabel(key), physicalPath, readOnly, database.get());
  database.release();
  connections.emplace(key, std::move(connection));
}

void DatabaseConnections::close(const std::string& key) {
  std::lock_guard lock(lifecycleMutex);
  const auto found = connections.find(key);
  if (found == connections.end()) {
    throw NitroSQLiteException::DatabaseNotOpen(connectionLabel(key));
  }
  auto connection = std::move(found->second);
  connections.erase(found);
  connection->close();
}

void DatabaseConnections::closeAll() {
  std::lock_guard lock(lifecycleMutex);
  for (auto& [key, connection] : connections) {
    connection->close();
  }
  connections.clear();
}

SQLiteConnectionPtr DatabaseConnections::get(const std::string& key) {
  std::lock_guard lock(lifecycleMutex);
  const auto found = connections.find(key);
  if (found == connections.end()) {
    throw NitroSQLiteException::DatabaseNotOpen(connectionLabel(key));
  }
  return found->second;
}

bool DatabaseConnections::isOpen(const std::string& key) {
  std::lock_guard lock(lifecycleMutex);
  return connections.contains(key);
}

std::optional<fs::path> DatabaseConnections::physicalPathForKey(const std::string& key) {
  std::lock_guard lock(lifecycleMutex);
  const auto live = connections.find(key);
  if (live != connections.end()) {
    return live->second->physicalPath;
  }
  const auto independent = parseIndependentId(key);
  return independent ? std::optional<fs::path>(independent->physicalPath) : std::nullopt;
}

std::optional<fs::path> DatabaseConnections::findLivePath(const fs::path& first, const fs::path& second) {
  std::optional<fs::path> found;
  withConnectionsLocked([&]() {
    for (const auto& [_, connection] : connections) {
      if (connection->database == nullptr) {
        continue;
      }
      anyDatabasePath(connection->database, [&](const fs::path& candidate) {
        if (sameFile(candidate, first)) {
          found = first;
          return true;
        }
        if (sameFile(candidate, second)) {
          found = second;
          return true;
        }
        return false;
      });
      if (found) {
        return;
      }
    }
  });
  return found;
}

void DatabaseConnections::withConnectionsLocked(const std::function<void()>& action) {
  std::lock_guard lifecycleLock(lifecycleMutex);
  std::vector<std::unique_lock<std::recursive_mutex>> locks;
  locks.reserve(connections.size());
  for (const auto& [_, connection] : connections) {
    locks.emplace_back(connection->mutex);
  }
  action();
}

void DatabaseConnections::drop(const std::string& dbName, const fs::path& path, const std::optional<std::string>& connectionId,
                               const std::optional<fs::path>& otherPath) {
  std::lock_guard lifecycleLock(lifecycleMutex);
  validateDatabaseName(dbName);
  const auto target = canonicalDatabasePath(path);
  if (!fs::exists(target)) {
    throw NitroSQLiteException::DatabaseFileNotFound(target.string());
  }
  const auto key = connectionId.value_or(dbName);
  const auto live = connections.find(key);
  const auto independent = connectionId ? parseIndependentId(*connectionId) : std::nullopt;
  if (connectionId && !independent) {
    throw NitroSQLiteException::DatabaseNotOpen(connectionLabel(key));
  }
  if (independent && (!sameFile(independent->physicalPath, target) || independent->readOnly)) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::SqlExecutionError, independent->readOnly
                                                                                ? "A read-only connection cannot delete a database"
                                                                                : "Connection targets a different database file");
  }
  if (live != connections.end()) {
    if (!sameFile(live->second->physicalPath, target)) {
      throw NitroSQLiteException(NitroSQLiteExceptionType::SqlExecutionError, "Connection targets a different database file");
    }
    if (live->second->readOnly) {
      throw NitroSQLiteException(NitroSQLiteExceptionType::SqlExecutionError, "A read-only connection cannot delete a database");
    }
  }

  const SQLiteConnectionPtr connectionToClose = live == connections.end() ? nullptr : live->second;
  withConnectionsLocked([&]() {
    if (isPathInUse(target, key) || (otherPath && isPathInUse(*otherPath, key))) {
      throw NitroSQLiteException(NitroSQLiteExceptionType::SqlExecutionError, "Database is in use by another connection");
    }
    if (!fs::exists(target)) {
      throw NitroSQLiteException::DatabaseFileNotFound(target.string());
    }
    if (connectionToClose) {
      close(key);
    }
    if (!nitro::rnnitrosqlite::removeDatabaseFiles(target.filename().string(), target.parent_path())) {
      throw NitroSQLiteException(NitroSQLiteExceptionType::SqlExecutionError, "Could not remove database files");
    }
    if (otherPath) {
      nitro::rnnitrosqlite::removeDatabaseFiles(otherPath->filename().string(), otherPath->parent_path());
    }
  });
}

bool DatabaseConnections::isPathInUse(const fs::path& path, const std::string& excludedKey) const {
  for (const auto& [key, connection] : connections) {
    if (key == excludedKey) {
      continue;
    }
    if (connection->database == nullptr) {
      continue;
    }
    if (anyDatabasePath(connection->database, [&](const fs::path& candidate) { return sameFile(candidate, path); })) {
      return true;
    }
  }
  return false;
}

DatabaseConnections& databaseConnections() {
  static DatabaseConnections registry;
  return registry;
}

void validateDatabaseName(const std::string& dbName) {
  if (dbName.find('\0') != std::string::npos) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::DatabaseCannotBeOpened, "Database name contains a NUL byte");
  }
}

fs::path canonicalDatabasePath(const fs::path& path) {
  std::error_code error;
  auto canonical = fs::weakly_canonical(path, error);
  if (!error) {
    return canonical;
  }
  return fs::absolute(path).lexically_normal();
}

} // namespace margelo::rnnitrosqlite
