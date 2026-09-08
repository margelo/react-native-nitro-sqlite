#include "HybridNitroSQLite.hpp"
#include "HybridNitroSQLiteQueryResult.hpp"
#include "NitroSQLiteException.hpp"
#include "importSqlFile.hpp"
#include "logs.hpp"
#include "macros.hpp"
#include "operations.hpp"
#include "sqliteExecuteBatch.hpp"
#include <filesystem>
#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <variant>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

// Copy any JS-backed ArrayBuffers on the JS thread so they can be safely
// accessed from the background thread used by Promise::async.
static std::optional<SQLiteQueryParams> copyArrayBufferParamsForBackground(const std::optional<SQLiteQueryParams>& params) {
  if (!params) {
    return std::nullopt;
  }

  SQLiteQueryParams copiedParams;
  copiedParams.reserve(params->size());

  for (const auto& value : *params) {
    if (std::holds_alternative<std::shared_ptr<ArrayBuffer>>(value)) {
      const auto& buffer = std::get<std::shared_ptr<ArrayBuffer>>(value);
      const auto copiedBuffer = ArrayBuffer::copy(buffer);
      copiedParams.push_back(copiedBuffer);
    } else {
      copiedParams.push_back(value);
    }
  }

  return copiedParams;
}

// Overload for batch execution: copy ArrayBuffer params inside each BatchQuery.
static std::vector<BatchQuery> copyArrayBufferParamsForBackground(const std::vector<BatchQuery>& commands) {
  std::vector<BatchQuery> copiedCommands;
  copiedCommands.reserve(commands.size());

  for (const auto& command : commands) {
    BatchQuery copiedCommand = command;

    if (command.params) {
      copiedCommand.params = copyArrayBufferParamsForBackground(command.params);
    }

    copiedCommands.push_back(std::move(copiedCommand));
  }

  return copiedCommands;
}

const std::string getDocPath(const std::optional<std::string>& location) {
  std::string tempDocPath = std::string(HybridNitroSQLite::docPath);
  if (location) {
    tempDocPath = tempDocPath + "/" + *location;
  }

  return tempDocPath;
}

// Moves a database (together with its -wal/-shm journal files) out of the directory a previous
// app version stored it in. Committed-but-uncheckpointed writes live in the -wal file and SQLite
// only replays it when it sits next to its database, so the set must never be separated: the
// whole set is copied before any original is deleted, and if anything fails the intact originals
// stay in place (the caller then keeps opening the database there) and the migration retries on
// the next open.
static void migrateDatabase(const std::string& dbName, const std::filesystem::path& fromDirectory,
                            const std::filesystem::path& toDirectory) {
  namespace fs = std::filesystem;
  const std::string files[] = {dbName, dbName + "-wal", dbName + "-shm"};
  std::error_code ec;

  if (!fs::exists(fromDirectory / dbName, ec)) {
    // Nothing to migrate. A previous run may have been interrupted after copying the set but
    // before removing the journal files, so sweep any leftovers out of the old directory.
    fs::remove(fromDirectory / (dbName + "-wal"), ec);
    fs::remove(fromDirectory / (dbName + "-shm"), ec);
    return;
  }

  // A database in the old directory means an older app version was writing there, so it is the
  // live copy. Remove whatever sits at the destination (e.g. after a downgrade and re-upgrade)
  // so a -wal from one database generation is never replayed into a database from another.
  for (const auto& file : files) {
    fs::remove(toDirectory / file, ec);
  }

  fs::create_directories(toDirectory, ec);
  for (const auto& file : files) {
    if (!fs::exists(fromDirectory / file, ec)) {
      continue;
    }

    if (!fs::copy_file(fromDirectory / file, toDirectory / file, ec) || ec) {
      LOGW("Failed to migrate database file %s: %s", file.c_str(), ec.message().c_str());
      return;
    }
  }

  // The database file is deleted first, and the journals only once that succeeds: if the
  // database cannot be removed, the caller keeps opening it from the old directory, so its -wal
  // must stay next to it or committed writes would be lost. An interruption after the first
  // delete can only leave journal files behind, which the sweep above removes on the next open.
  if (!fs::remove(fromDirectory / dbName, ec) || ec) {
    LOGW("Failed to remove migrated database %s from its old location: %s", dbName.c_str(), ec.message().c_str());
    return;
  }
  fs::remove(fromDirectory / (dbName + "-wal"), ec);
  fs::remove(fromDirectory / (dbName + "-shm"), ec);
}

void HybridNitroSQLite::open(const std::string& dbName, const std::optional<std::string>& location) {
  auto docPath = getDocPath(location);

  if (!migrationDocPath.empty()) {
    std::string oldDocPath = migrationDocPath;
    if (location) {
      oldDocPath = oldDocPath + "/" + *location;
    }

    migrateDatabase(dbName, oldDocPath, docPath);

    // If the database could not be moved out of its old directory, keep opening it there rather
    // than creating a fresh empty one; the migration retries on the next open.
    std::error_code ec;
    if (std::filesystem::exists(std::filesystem::path(oldDocPath) / dbName, ec)) {
      docPath = oldDocPath;
    }
  }

  sqliteOpenDb(dbName, docPath);
}

void HybridNitroSQLite::close(const std::string& dbName) {
  sqliteCloseDb(dbName);
};

void HybridNitroSQLite::drop(const std::string& dbName, const std::optional<std::string>& location) {
  const auto docPath = getDocPath(location);
  sqliteRemoveDb(dbName, docPath);
};

void HybridNitroSQLite::attach(const std::string& mainDbName, const std::string& dbNameToAttach, const std::string& alias,
                               const std::optional<std::string>& location) {
  std::string tempDocPath = std::string(docPath);
  if (location) {
    tempDocPath = tempDocPath + "/" + *location;
  }

  sqliteAttachDb(mainDbName, tempDocPath, dbNameToAttach, alias);
};

void HybridNitroSQLite::detach(const std::string& mainDbName, const std::string& alias) {
  sqliteDetachDb(mainDbName, alias);
};

std::shared_ptr<HybridNitroSQLiteQueryResultSpec> HybridNitroSQLite::execute(const std::string& dbName, const std::string& query,
                                                                             const std::optional<SQLiteQueryParams>& params) {
  return sqliteExecute(dbName, query, params);
};

std::shared_ptr<Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>>
HybridNitroSQLite::executeAsync(const std::string& dbName, const std::string& query, const std::optional<SQLiteQueryParams>& params) {
  const auto copiedParams = copyArrayBufferParamsForBackground(params);

  return Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>::async(
      [=, this]() -> std::shared_ptr<HybridNitroSQLiteQueryResultSpec> {
        auto result = sqliteExecute(dbName, query, copiedParams);
        return result;
      });
};

BatchQueryResult HybridNitroSQLite::executeBatch(const std::string& dbName, const std::vector<BatchQueryCommand>& batchParams) {
  const auto commands = batchParamsToCommands(batchParams);

  auto result = sqliteExecuteBatch(dbName, commands);
  return BatchQueryResult(result.rowsAffected);
};

std::shared_ptr<Promise<BatchQueryResult>> HybridNitroSQLite::executeBatchAsync(const std::string& dbName,
                                                                                const std::vector<BatchQueryCommand>& batchParams) {
  // Convert BatchQueryCommand objects on the JS thread and copy any JS-backed
  // ArrayBuffers into native buffers before going off-thread.
  const auto commands = batchParamsToCommands(batchParams);
  const auto copiedCommands = copyArrayBufferParamsForBackground(commands);

  return Promise<BatchQueryResult>::async([=, this]() -> BatchQueryResult {
    auto result = sqliteExecuteBatch(dbName, copiedCommands);
    return BatchQueryResult(result.rowsAffected);
  });
};

FileLoadResult HybridNitroSQLite::loadFile(const std::string& dbName, const std::string& location) {
  const auto result = importSqlFile(dbName, location);
  return FileLoadResult(result.commands, result.rowsAffected);
};

std::shared_ptr<Promise<FileLoadResult>> HybridNitroSQLite::loadFileAsync(const std::string& dbName, const std::string& location) {
  return Promise<FileLoadResult>::async([=, this]() -> FileLoadResult {
    auto result = loadFile(dbName, location);
    return result;
  });
};

} // namespace margelo::nitro::rnnitrosqlite
