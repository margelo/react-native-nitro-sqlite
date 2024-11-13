/**
 * SQL Batch execution implementation using default sqliteBridge implementation
 */
#include "sqliteExecuteBatch.hpp"
#include "operations.hpp"
#include <utility>
#include "NitroSQLiteException.hpp"

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
          commands.push_back(BatchQuery{command.query, std::make_shared<ParamsVec>(params)});
        }
      } else {
        commands.push_back(BatchQuery{command.query, std::make_shared<ParamsVec>(std::move(std::get<ParamsVec>(*command.params)))});
      }
    } else {
      commands.push_back(BatchQuery{command.query, NULL});
    }
  }

  return commands;
}

SQLiteOperationResult sqliteExecuteBatch(const std::string& dbName, const std::vector<BatchQuery>& commands) {
  size_t commandCount = commands.size();
  if (commandCount <= 0) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::NoBatchCommandsProvided, "No SQL batch commands provided");
  }

  try {
    int rowsAffected = 0;
    sqliteExecuteLiteral(dbName, "BEGIN EXCLUSIVE TRANSACTION");
    for (int i = 0; i < commandCount; i++) {
      const auto command = commands.at(i);

      // We do not provide a datas tructure to receive query data because we don't need/want to handle this results in a batch execution
      auto results = SQLiteQueryResults();
      auto metadata = std::optional<SQLiteQueryTableMetadata>(std::nullopt);
      try {
        auto result = sqliteExecute(dbName, command.sql, *command.params.get());
        rowsAffected += result.rowsAffected;
      } catch (NitroSQLiteException& e) {
        sqliteExecuteLiteral(dbName, "ROLLBACK");
        throw e;
      }
    }
    sqliteExecuteLiteral(dbName, "COMMIT");
    return {
        .rowsAffected = rowsAffected,
        .commands = (int)commandCount,
    };
  } catch (NitroSQLiteException& e) {
    sqliteExecuteLiteral(dbName, "ROLLBACK");
    throw e;
  }
}

} // namespace margelo::rnnitrosqlite
