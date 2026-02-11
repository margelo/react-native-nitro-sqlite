#include "HybridNitroSQLite.hpp"
#include "HybridNitroSQLiteQueryResult.hpp"
#include "NitroSQLiteException.hpp"
#include "importSqlFile.hpp"
#include "logs.hpp"
#include "macros.hpp"
#include "operations.hpp"
#include "sqliteExecuteBatch.hpp"
#include <iostream>
#include <map>
#include <string>
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

const std::string getDocPath(const std::optional<std::string>& location) {
  std::string tempDocPath = std::string(HybridNitroSQLite::docPath);
  if (location) {
    tempDocPath = tempDocPath + "/" + *location;
  }

  return tempDocPath;
}

void HybridNitroSQLite::open(const std::string& dbName, const std::optional<std::string>& location) {
  const auto docPath = getDocPath(location);
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
  return Promise<BatchQueryResult>::async([=, this]() -> BatchQueryResult {
    auto result = executeBatch(dbName, batchParams);
    return result;
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
