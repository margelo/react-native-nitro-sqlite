#include "HybridNitroSQLite.hpp"
#include "HybridNativeQueryResult.hpp"
#include "NitroSQLiteException.hpp"
#include "logs.hpp"
#include "macros.hpp"
#include "sqliteExecuteBatch.hpp"
#include "importSqlFile.hpp"
#include "operations.hpp"
#include <iostream>
#include <map>
#include <string>
#include <vector>

namespace margelo::nitro::rnnitrosqlite {

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

using ExecuteQueryResult = std::shared_ptr<HybridNativeQueryResultSpec>;

ExecuteQueryResult HybridNitroSQLite::execute(const std::string& dbName, const std::string& query,
                                             const std::optional<SQLiteQueryParams>& params) {
  auto result = sqliteExecute(dbName, query, params);
  return std::make_shared<HybridNativeQueryResult>(result.insertId, result.rowsAffected, *result.results, *result.metadata);
};

std::shared_ptr<Promise<std::shared_ptr<HybridNativeQueryResultSpec>>> HybridNitroSQLite::executeAsync(const std::string& dbName, const std::string& query,
                                                                                                       const std::optional<SQLiteQueryParams>& params) {
  return Promise<std::shared_ptr<HybridNativeQueryResultSpec>>::async([=, this]() -> std::shared_ptr<HybridNativeQueryResultSpec> {
    auto result = execute(dbName, query, params);
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
