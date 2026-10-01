/**
 * SQL Batch execution implementation using default sqliteBridge implementation
 */
#include "NitroSQLiteExecuteBatch.hpp"
#include "NitroSQLiteException.hpp"
#include "NitroSQLiteOperations.hpp"
#include <utility>

namespace margelo::nitro::rnnitrosqlite {

std::vector<BatchQuery> batchParamsToCommands(const std::vector<BatchQueryCommand>& batchParams) {
  auto commands = std::vector<BatchQuery>();
  commands.reserve(batchParams.size());

  for (const auto& command : batchParams) {
    BatchQuery groupedCommand{command.query, {}};
    if (command.params) {
      using ParamsVec = SQLiteQueryParams;
      using NestedParamsVec = std::vector<ParamsVec>;

      if (std::holds_alternative<NestedParamsVec>(*command.params)) {
        groupedCommand.parameterSets = std::get<NestedParamsVec>(*command.params);
      } else {
        groupedCommand.parameterSets.push_back(std::get<ParamsVec>(*command.params));
      }
    } else {
      groupedCommand.parameterSets.emplace_back();
    }
    if (!groupedCommand.parameterSets.empty()) {
      commands.push_back(std::move(groupedCommand));
    }
  }

  return commands;
}

SQLiteOperationResult sqliteExecuteBatch(const std::string& dbName, const std::vector<BatchQuery>& commands) {
  return sqliteExecuteBatch(sqliteGetOpenDatabase(dbName), commands);
}

SQLiteOperationResult sqliteExecuteBatch(const SQLiteConnectionPtr& connection, const std::vector<BatchQuery>& commands) {
  std::lock_guard lock(connection->mutex);
  if (commands.empty()) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::NoBatchCommandsProvided, "No SQL batch commands provided");
  }

  try {
    int rowsAffected = 0;
    int commandCount = 0;
    sqliteExecuteCommand(connection, "BEGIN EXCLUSIVE TRANSACTION");
    for (const auto& command : commands) {
      auto result = sqliteExecuteCommandGroup(connection, command.sql, command.parameterSets);
      rowsAffected += result.rowsAffected;
      commandCount += result.commands;
    }

    sqliteExecuteCommand(connection, "COMMIT");
    return {
        .rowsAffected = rowsAffected,
        .commands = commandCount,
    };
  } catch (...) {
    // Roll back exactly once; a failed ROLLBACK must not mask the original error.
    try {
      sqliteExecuteCommand(connection, "ROLLBACK");
    } catch (...) {
      // ignore — surface the original error below
    }
    throw;
  }
}

} // namespace margelo::nitro::rnnitrosqlite
