#include "HybridNitroSQLite.hpp"
#include "../SQLiteDatabaseMigration.hpp"
#include "../SQLiteException.hpp"
#include "../SQLiteExecuteBatch.hpp"
#include "../SQLiteImportSqlFile.hpp"
#include "../SQLiteLogs.hpp"
#include "../SQLiteMacros.hpp"
#include "../SQLiteOperations.hpp"
#include "HybridPreparedStatement.hpp"
#include <cstdlib>
#include <exception>
#include <filesystem>
#include <iostream>
#include <map>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

// SQLite caches SQLITE_TMPDIR when it initializes its VFS, so only the first root sets it.
static void configureTemporaryDirectory(const std::string& temporaryDirectory) {
  static std::once_flag configureOnce;
  static bool configured = false;
  std::call_once(configureOnce, [&] { configured = setenv("SQLITE_TMPDIR", temporaryDirectory.c_str(), 1) == 0; });
  if (!configured) {
    throw std::runtime_error("Could not configure SQLite temporary directory");
  }
}

HybridNitroSQLite::HybridNitroSQLite(std::string databaseDirectory, const std::optional<std::string>& temporaryDirectory,
                                     const std::optional<std::string>& legacyDatabaseDirectory)
    : _databaseDirectory(std::move(databaseDirectory)), _legacyDatabaseDirectory(legacyDatabaseDirectory.value_or("")) {
  if (temporaryDirectory) {
    configureTemporaryDirectory(*temporaryDirectory);
  }
}

// Copy any JS-backed ArrayBuffers on the JS thread so they can be safely
// accessed from the connection's background worker.
static std::optional<SQLiteQueryParams> copyArrayBufferParamsForBackground(const std::optional<SQLiteQueryParams>& params) {
  if (!params) {
    return std::nullopt;
  }

  SQLiteQueryParams copiedParams;
  copiedParams.reserve(params->size());

  for (const auto& value : *params) {
    if (value && std::holds_alternative<ArrayBuffer>(*value)) {
      const auto& buffer = std::get<ArrayBuffer>(*value);
      const auto copiedBuffer = ArrayBuffer::copy(buffer);
      copiedParams.push_back(copiedBuffer);
    } else {
      copiedParams.push_back(value);
    }
  }

  return copiedParams;
}

// Replace JS-backed ArrayBuffers inside each grouped batch command with native copies, in place.
static void copyArrayBuffersForBackground(std::vector<BatchQuery>& commands) {
  for (auto& command : commands) {
    for (auto& params : command.parameterSets) {
      for (auto& value : params) {
        if (value && std::holds_alternative<ArrayBuffer>(*value)) {
          *value = ArrayBuffer::copy(std::get<ArrayBuffer>(*value));
        }
      }
    }
  }
}

template <typename Result, typename Operation>
static Promise<Result> enqueueConnectionOperation(const SQLiteConnectionPtr& connection, Operation&& operation) {
  auto promise = Promise<Result>::pending();
  try {
    connection->enqueueAsync([promise, operation = std::forward<Operation>(operation)]() mutable {
      std::optional<Result> result;
      try {
        result.emplace(operation());
      } catch (...) {
        promise.reject(std::current_exception());
        return;
      }
      // Resolving may dispatch to JavaScript and throw after the native promise
      // has settled. Do not try to reject that same promise again.
      try {
        promise.resolve(std::move(*result));
      } catch (...) {
        if (promise.isPending()) {
          promise.reject(std::current_exception());
          return;
        }
        throw;
      }
    });
  } catch (...) {
    promise.reject(std::current_exception());
  }
  return promise;
}

const std::string getDocPath(const std::string& databaseDirectory, const std::optional<std::string>& location) {
  if (location && location->find('\0') != std::string::npos) {
    throw SQLiteException(SQLiteExceptionType::DatabaseCannotBeOpened, "Database location contains a NUL byte");
  }
  std::string tempDocPath = databaseDirectory;
  if (location) {
    tempDocPath = tempDocPath + "/" + *location;
  }

  return tempDocPath;
}

const std::string getOldDocPath(const std::string& legacyDatabaseDirectory, const std::optional<std::string>& location) {
  std::string oldDocPath = legacyDatabaseDirectory;
  if (location) {
    oldDocPath = oldDocPath + "/" + *location;
  }

  return oldDocPath;
}

const std::string getMigratedDocPath(DatabaseConnections& connections, const std::string& databaseDirectory,
                                     const std::string& legacyDatabaseDirectory, const std::string& dbName,
                                     const std::optional<std::string>& location, bool readOnly = false) {
  const auto currentDocPath = getDocPath(databaseDirectory, location);
  if (legacyDatabaseDirectory.empty()) {
    return currentDocPath;
  }
  const auto oldDocPath = getOldDocPath(legacyDatabaseDirectory, location);
  std::string selectedPath;
  connections.withConnectionsLocked([&]() {
    const auto oldPath = std::filesystem::path(oldDocPath) / dbName;
    const auto livePath = connections.findLivePath(oldPath, std::filesystem::path(currentDocPath) / dbName);
    if (livePath) {
      selectedPath = *livePath == oldPath ? oldDocPath : currentDocPath;
    } else if (readOnly) {
      selectedPath = std::filesystem::exists(std::filesystem::path(oldDocPath) / dbName) ? oldDocPath : currentDocPath;
    } else {
      selectedPath = migrateDatabase(dbName, oldDocPath, currentDocPath).string();
    }
  });
  return selectedPath;
}

void HybridNitroSQLite::open(const std::string& dbName, const std::optional<std::string>& location, const std::optional<bool>& readOnly,
                             const std::optional<std::string>& encryptionKey) {
  validateDatabaseName(dbName);
  std::lock_guard lock(_connections.lifecycleMutex);
  if (_connections.isOpen(dbName)) {
    throw SQLiteException::DatabaseAlreadyOpen(dbName);
  }
  const auto docPath =
      getMigratedDocPath(_connections, _databaseDirectory, _legacyDatabaseDirectory, dbName, location, readOnly.value_or(false));
  sqliteOpenDb(_connections, dbName, docPath, readOnly.value_or(false), encryptionKey);
}

std::string HybridNitroSQLite::openConnection(const std::string& dbName, const std::optional<std::string>& location,
                                              const std::optional<bool>& readOnly, const std::optional<std::string>& encryptionKey) {
  validateDatabaseName(dbName);
  if (sqlite3_threadsafe() == 0) {
    throw SQLiteException(SQLiteExceptionType::DatabaseCannotBeOpened, "Independent connections require a thread-safe SQLite build");
  }
  std::lock_guard lock(_connections.lifecycleMutex);
  const auto docPath =
      getMigratedDocPath(_connections, _databaseDirectory, _legacyDatabaseDirectory, dbName, location, readOnly.value_or(false));
  return sqliteOpenConnection(_connections, dbName, docPath, readOnly.value_or(false), encryptionKey);
}

void HybridNitroSQLite::close(const std::string& dbName) {
  _connections.close(dbName);
};

bool HybridNitroSQLite::isConnectionOpen(const std::string& connectionId) {
  return _connections.isOpen(connectionId);
}

void HybridNitroSQLite::drop(const std::string& dbName, const std::optional<std::string>& location,
                             const std::optional<std::string>& connectionId) {
  validateDatabaseName(dbName);
  std::lock_guard lock(_connections.lifecycleMutex);
  const auto currentDocPath = getDocPath(_databaseDirectory, location);
  if (_legacyDatabaseDirectory.empty()) {
    sqliteRemoveDb(_connections, dbName, currentDocPath, connectionId);
    return;
  }

  const auto oldDocPath = getOldDocPath(_legacyDatabaseDirectory, location);
  const auto preferredPath = _connections.physicalPathForKey(connectionId.value_or(dbName));
  const auto currentPath = std::filesystem::path(currentDocPath) / dbName;
  std::error_code ec;
  const bool oldDatabaseExists = std::filesystem::exists(std::filesystem::path(oldDocPath) / dbName, ec);
  if (ec) {
    LOGW("Failed to inspect database %s in its old location: %s", dbName.c_str(), ec.message().c_str());
  }

  // A stale copy in the old directory must not override the actual target of a live or
  // recently closed independent connection.
  std::error_code equivalentError;
  const bool prefersCurrent = preferredPath && (std::filesystem::equivalent(*preferredPath, currentPath, equivalentError) ||
                                                canonicalDatabasePath(*preferredPath) == canonicalDatabasePath(currentPath));
  const bool useOldPath = !prefersCurrent && (preferredPath || oldDatabaseExists || ec);
  sqliteRemoveDb(_connections, dbName, useOldPath ? oldDocPath : currentDocPath, connectionId, useOldPath ? currentDocPath : oldDocPath);
};

void HybridNitroSQLite::attach(const std::string& mainDbName, const std::string& dbNameToAttach, const std::string& alias,
                               const std::optional<std::string>& location) {
  validateDatabaseName(dbNameToAttach);
  std::lock_guard lock(_connections.lifecycleMutex);
  if (_connections.get(mainDbName)->readOnly) {
    throw SQLiteException(SQLiteExceptionType::UnableToAttachToDatabase, "Cannot attach a database to a read-only connection");
  }
  const auto attachedDocPath = getMigratedDocPath(_connections, _databaseDirectory, _legacyDatabaseDirectory, dbNameToAttach, location);
  sqliteAttachDb(_connections.get(mainDbName), attachedDocPath, dbNameToAttach, alias);
};

void HybridNitroSQLite::detach(const std::string& mainDbName, const std::string& alias) {
  sqliteDetachDb(_connections.get(mainDbName), alias);
};

NativeQueryResult HybridNitroSQLite::execute(const std::string& dbName, const std::string& query,
                                             const std::optional<SQLiteQueryParams>& params) {
  return sqliteExecute(_connections.get(dbName), query, params);
};

Promise<NativeQueryResult> HybridNitroSQLite::executeAsync(const std::string& dbName, const std::string& query,
                                                           const std::optional<SQLiteQueryParams>& params,
                                                           const std::optional<Callback<void(SQLiteQueryResults)>>& onRows) {
  auto copiedParams = copyArrayBufferParamsForBackground(params);
  SQLiteConnectionPtr connection;
  try {
    connection = _connections.get(dbName);
  } catch (...) {
    return Promise<NativeQueryResult>::rejected(std::current_exception());
  }

  SQLiteRowBatchHandler rowBatchHandler = nullptr;
  if (onRows) {
    rowBatchHandler = [onRows = *onRows](SQLiteQueryResults rows) { onRows(std::move(rows)); };
  }

  return enqueueConnectionOperation<NativeQueryResult>(
      connection,
      [connection, query, copiedParams = std::move(copiedParams), rowBatchHandler = std::move(rowBatchHandler)]() -> NativeQueryResult {
        return sqliteExecute(connection, query, copiedParams, rowBatchHandler);
      });
};

std::shared_ptr<HybridPreparedStatementSpec> HybridNitroSQLite::prepare(const std::string& dbName, const std::string& query) {
  return std::make_shared<HybridPreparedStatement>(sqlitePrepare(_connections.get(dbName), query));
}

BatchQueryResult HybridNitroSQLite::executeBatch(const std::string& dbName, const std::vector<BatchQueryCommand>& batchParams) {
  const auto commands = batchParamsToCommands(batchParams);

  auto result = sqliteExecuteBatch(_connections.get(dbName), commands);
  return BatchQueryResult(result.rowsAffected);
};

Promise<BatchQueryResult> HybridNitroSQLite::executeBatchAsync(const std::string& dbName,
                                                               const std::vector<BatchQueryCommand>& batchParams) {
  // Convert BatchQueryCommand objects on the JS thread and copy any JS-backed
  // ArrayBuffers into native buffers before going off-thread.
  auto commands = batchParamsToCommands(batchParams);
  copyArrayBuffersForBackground(commands);
  SQLiteConnectionPtr connection;
  try {
    connection = _connections.get(dbName);
  } catch (...) {
    return Promise<BatchQueryResult>::rejected(std::current_exception());
  }

  return enqueueConnectionOperation<BatchQueryResult>(connection, [connection, commands = std::move(commands)]() -> BatchQueryResult {
    auto result = sqliteExecuteBatch(connection, commands);
    return BatchQueryResult(result.rowsAffected);
  });
};

FileLoadResult HybridNitroSQLite::loadFile(const std::string& dbName, const std::string& location) {
  const auto result = importSqlFile(_connections.get(dbName), location);
  return FileLoadResult(result.commands, result.rowsAffected);
};

Promise<FileLoadResult> HybridNitroSQLite::loadFileAsync(const std::string& dbName, const std::string& location) {
  SQLiteConnectionPtr connection;
  try {
    connection = _connections.get(dbName);
  } catch (...) {
    return Promise<FileLoadResult>::rejected(std::current_exception());
  }
  return enqueueConnectionOperation<FileLoadResult>(connection, [connection, location]() -> FileLoadResult {
    const auto result = importSqlFile(connection, location);
    return FileLoadResult(result.commands, result.rowsAffected);
  });
};

} // namespace margelo::nitro::rnnitrosqlite
