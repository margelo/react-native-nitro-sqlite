#include "HybridNitroSQLite.hpp"
#include "../NitroSQLiteDatabaseMigration.hpp"
#include "../NitroSQLiteException.hpp"
#include "../NitroSQLiteExecuteBatch.hpp"
#include "../NitroSQLiteImportSqlFile.hpp"
#include "../NitroSQLiteLogs.hpp"
#include "../NitroSQLiteMacros.hpp"
#include "../NitroSQLiteOperations.hpp"
#include "HybridNitroSQLitePreparedStatement.hpp"
#include "HybridNitroSQLiteQueryResult.hpp"
#include <exception>
#include <filesystem>
#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <utility>
#include <variant>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

// Copy any JS-backed ArrayBuffers on the JS thread so they can be safely
// accessed from the connection's background worker.
static std::optional<SQLiteQueryParams> copyArrayBufferParamsForBackground(const std::optional<SQLiteQueryParams>& params) {
  if (!params) {
    return std::nullopt;
  }

  SQLiteQueryParams copiedParams;
  copiedParams.reserve(params->size());

  for (const auto& value : *params) {
    if (value && std::holds_alternative<std::shared_ptr<ArrayBuffer>>(*value)) {
      const auto& buffer = std::get<std::shared_ptr<ArrayBuffer>>(*value);
      const auto copiedBuffer = ArrayBuffer::copy(buffer);
      copiedParams.push_back(copiedBuffer);
    } else {
      copiedParams.push_back(value);
    }
  }

  return copiedParams;
}

// Copy ArrayBuffer params inside each grouped batch command.
static std::vector<BatchQuery> copyArrayBufferParamsForBackground(const std::vector<BatchQuery>& commands) {
  std::vector<BatchQuery> copiedCommands;
  copiedCommands.reserve(commands.size());

  for (const auto& command : commands) {
    BatchQuery copiedCommand{command.sql, {}};
    copiedCommand.parameterSets.reserve(command.parameterSets.size());
    for (const auto& params : command.parameterSets) {
      copiedCommand.parameterSets.push_back(*copyArrayBufferParamsForBackground(params));
    }

    copiedCommands.push_back(std::move(copiedCommand));
  }

  return copiedCommands;
}

template <typename Result, typename Operation>
static std::shared_ptr<Promise<Result>> enqueueConnectionOperation(const SQLiteConnectionPtr& connection, Operation&& operation) {
  auto promise = Promise<Result>::create();
  try {
    connection->enqueueAsync([promise, operation = std::forward<Operation>(operation)]() mutable {
      std::optional<Result> result;
      try {
        result.emplace(operation());
      } catch (...) {
        promise->reject(std::current_exception());
        return;
      }
      // Resolving may dispatch to JavaScript and throw after the native promise
      // has settled. Do not try to reject that same promise again.
      try {
        promise->resolve(std::move(*result));
      } catch (...) {
        if (promise->isPending()) {
          promise->reject(std::current_exception());
          return;
        }
        throw;
      }
    });
  } catch (...) {
    promise->reject(std::current_exception());
  }
  return promise;
}

const std::string getDocPath(const std::optional<std::string>& location) {
  if (location && location->find('\0') != std::string::npos) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::DatabaseCannotBeOpened, "Database location contains a NUL byte");
  }
  std::string tempDocPath = std::string(HybridNitroSQLite::docPath);
  if (location) {
    tempDocPath = tempDocPath + "/" + *location;
  }

  return tempDocPath;
}

const std::string getOldDocPath(const std::optional<std::string>& location) {
  std::string oldDocPath = HybridNitroSQLite::migrationDocPath;
  if (location) {
    oldDocPath = oldDocPath + "/" + *location;
  }

  return oldDocPath;
}

const std::string getMigratedDocPath(DatabaseConnections& connections, const std::string& dbName,
                                     const std::optional<std::string>& location, bool readOnly = false) {
  const auto currentDocPath = getDocPath(location);
  if (HybridNitroSQLite::migrationDocPath.empty()) {
    return currentDocPath;
  }
  const auto oldDocPath = getOldDocPath(location);
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

void HybridNitroSQLite::open(const std::string& dbName, const std::optional<std::string>& location, std::optional<bool> readOnly,
                             const std::optional<std::string>& encryptionKey) {
  validateDatabaseName(dbName);
  std::lock_guard lock(_connections.lifecycleMutex);
  if (_connections.isOpen(dbName)) {
    throw NitroSQLiteException::DatabaseAlreadyOpen(dbName);
  }
  const auto docPath = getMigratedDocPath(_connections, dbName, location, readOnly.value_or(false));
  sqliteOpenDb(_connections, dbName, docPath, readOnly.value_or(false), encryptionKey);
}

std::string HybridNitroSQLite::openConnection(const std::string& dbName, const std::optional<std::string>& location,
                                              std::optional<bool> readOnly, const std::optional<std::string>& encryptionKey) {
  validateDatabaseName(dbName);
  if (sqlite3_threadsafe() == 0) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::DatabaseCannotBeOpened,
                               "Independent connections require a thread-safe SQLite build");
  }
  std::lock_guard lock(_connections.lifecycleMutex);
  const auto docPath = getMigratedDocPath(_connections, dbName, location, readOnly.value_or(false));
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
  const auto currentDocPath = getDocPath(location);
  if (migrationDocPath.empty()) {
    sqliteRemoveDb(_connections, dbName, currentDocPath, connectionId);
    return;
  }

  const auto oldDocPath = getOldDocPath(location);
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
    throw NitroSQLiteException(NitroSQLiteExceptionType::UnableToAttachToDatabase, "Cannot attach a database to a read-only connection");
  }
  const auto attachedDocPath = getMigratedDocPath(_connections, dbNameToAttach, location);
  sqliteAttachDb(_connections.get(mainDbName), attachedDocPath, dbNameToAttach, alias);
};

void HybridNitroSQLite::detach(const std::string& mainDbName, const std::string& alias) {
  sqliteDetachDb(_connections.get(mainDbName), alias);
};

std::shared_ptr<HybridNitroSQLiteQueryResultSpec> HybridNitroSQLite::execute(const std::string& dbName, const std::string& query,
                                                                             const std::optional<SQLiteQueryParams>& params) {
  return sqliteExecute(_connections.get(dbName), query, params);
};

std::shared_ptr<Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>>
HybridNitroSQLite::executeAsync(const std::string& dbName, const std::string& query, const std::optional<SQLiteQueryParams>& params) {
  const auto copiedParams = copyArrayBufferParamsForBackground(params);
  SQLiteConnectionPtr connection;
  try {
    connection = _connections.get(dbName);
  } catch (...) {
    return Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>::rejected(std::current_exception());
  }

  return enqueueConnectionOperation<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>(
      connection, [connection, query, copiedParams]() -> std::shared_ptr<HybridNitroSQLiteQueryResultSpec> {
        auto result = sqliteExecute(connection, query, copiedParams);
        return result;
      });
};

std::shared_ptr<HybridNitroSQLitePreparedStatementSpec> HybridNitroSQLite::prepare(const std::string& dbName, const std::string& query) {
  return std::make_shared<HybridNitroSQLitePreparedStatement>(sqlitePrepare(_connections.get(dbName), query));
}

BatchQueryResult HybridNitroSQLite::executeBatch(const std::string& dbName, const std::vector<BatchQueryCommand>& batchParams) {
  const auto commands = batchParamsToCommands(batchParams);

  auto result = sqliteExecuteBatch(_connections.get(dbName), commands);
  return BatchQueryResult(result.rowsAffected);
};

std::shared_ptr<Promise<BatchQueryResult>> HybridNitroSQLite::executeBatchAsync(const std::string& dbName,
                                                                                const std::vector<BatchQueryCommand>& batchParams) {
  // Convert BatchQueryCommand objects on the JS thread and copy any JS-backed
  // ArrayBuffers into native buffers before going off-thread.
  const auto commands = batchParamsToCommands(batchParams);
  const auto copiedCommands = copyArrayBufferParamsForBackground(commands);
  SQLiteConnectionPtr connection;
  try {
    connection = _connections.get(dbName);
  } catch (...) {
    return Promise<BatchQueryResult>::rejected(std::current_exception());
  }

  return enqueueConnectionOperation<BatchQueryResult>(connection, [connection, copiedCommands]() -> BatchQueryResult {
    auto result = sqliteExecuteBatch(connection, copiedCommands);
    return BatchQueryResult(result.rowsAffected);
  });
};

FileLoadResult HybridNitroSQLite::loadFile(const std::string& dbName, const std::string& location) {
  const auto result = importSqlFile(_connections.get(dbName), location);
  return FileLoadResult(result.commands, result.rowsAffected);
};

std::shared_ptr<Promise<FileLoadResult>> HybridNitroSQLite::loadFileAsync(const std::string& dbName, const std::string& location) {
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
