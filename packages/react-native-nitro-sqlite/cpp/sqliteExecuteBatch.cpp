/**
 * SQL Batch execution implementation using default sqliteBridge implementation
 */
#include "sqliteExecuteBatch.hpp"
#include "NitroSQLiteException.hpp"
#include "operations.hpp"
#include <utility>

namespace margelo::rnnitrosqlite {

std::vector<BatchQuery> batchParamsToCommands(const std::vector<BatchQueryCommand>& batchParams) {
  auto commands = std::vector<BatchQuery>();

  for (auto& command : batchParams) {
    if (command.params) {
      using ParamsVec = SQLiteQueryParams;
      using NestedParamsVec = std::vector<ParamsVec>;

      if (std::holds_alternative<NestedParamsVec>(*command.params)) {
        // This arguments is an array of arrays, like a batch update of a single sql command.
        for (const auto& params : std::get<NestedParamsVec>(*command.params)) {
          commands.push_back(BatchQuery{command.query, ParamsVec(params)});
        }
      } else {
        commands.push_back(BatchQuery{command.query, std::move(std::get<ParamsVec>(*command.params))});
      }
    } else {
      commands.push_back(BatchQuery{command.query, std::nullopt});
    }
  }

  return commands;
}

SQLiteOperationResult sqliteExecuteBatch(const std::string& dbName, const std::vector<BatchQuery>& commands) {
  return sqliteExecuteBatch(sqliteGetOpenDatabase(dbName), commands);
}

SQLiteOperationResult sqliteExecuteBatch(const SQLiteConnectionPtr& connection, const std::vector<BatchQuery>& commands) {
  std::lock_guard lock(connection->mutex);
  size_t commandCount = commands.size();
  if (commandCount <= 0) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::NoBatchCommandsProvided, "No SQL batch commands provided");
  }

  try {
    int rowsAffected = 0;
    sqliteExecuteCommand(connection, "BEGIN EXCLUSIVE TRANSACTION");
    for (const auto& command : commands) {
      auto result = sqliteExecuteCommand(connection, command.sql, command.params);
      rowsAffected += result.rowsAffected;
    }

    sqliteExecuteCommand(connection, "COMMIT");
    return {
        .rowsAffected = rowsAffected,
        .commands = (int)commandCount,
    };
  } catch (NitroSQLiteException& e) {
    // Roll back exactly once; a failed ROLLBACK must not mask the original error.
    try {
      sqliteExecuteCommand(connection, "ROLLBACK");
    } catch (...) {
      // ignore — surface the original error below
    }
    throw e;
  }
}

} // namespace margelo::rnnitrosqlite
