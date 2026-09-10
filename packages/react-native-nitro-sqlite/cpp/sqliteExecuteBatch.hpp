/**
 * SQL Batch execution implementation using default sqliteBridge implementation
 */
#pragma once

#include "BatchQueryCommand.hpp"
#include "types.hpp"
#include <memory>

using namespace facebook;
using namespace margelo::nitro;

namespace margelo::rnnitrosqlite {

struct SQLiteConnection;

struct BatchQuery {
  std::string sql;
  std::optional<SQLiteQueryParams> params;
};

/**
 * Local Helper method to translate JSI objects BatchQuery datastructure
 * MUST be called in the JavaScript Thread
 */
std::vector<BatchQuery> batchParamsToCommands(const std::vector<BatchQueryCommand>& batchParams);

/**
 * Execute a batch of commands in a exclusive transaction
 */
SQLiteOperationResult sqliteExecuteBatch(const std::string& dbName, const std::vector<BatchQuery>& commands);
SQLiteOperationResult sqliteExecuteBatch(const std::shared_ptr<SQLiteConnection>& connection, const std::vector<BatchQuery>& commands);

} // namespace margelo::rnnitrosqlite
