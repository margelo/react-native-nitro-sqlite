/**
 * SQL File Loader implementation
 */

#include "NitroSQLiteImportSqlFile.hpp"
#include "NitroSQLiteException.hpp"
#include "NitroSQLiteOperations.hpp"
#include <fstream>
#include <iostream>
#include <optional>

namespace margelo::nitro::rnnitrosqlite {

SQLiteOperationResult importSqlFile(const std::string& dbName, const std::string& fileLocation) {
  return importSqlFile(sqliteGetOpenDatabase(dbName), fileLocation);
}

SQLiteOperationResult importSqlFile(const SQLiteConnectionPtr& connection, const std::string& fileLocation) {
  std::lock_guard lock(connection->mutex);
  std::ifstream sqFile(fileLocation);
  if (!sqFile.is_open()) {
    throw NitroSQLiteException::CouldNotLoadFile(fileLocation);
  }

  int rowsAffected = 0;
  int commands = 0;
  int lineNumber = 0;
  bool transactionStarted = false;
  std::string command = "BEGIN EXCLUSIVE TRANSACTION";
  std::optional<int> commandLine;

  try {
    sqliteExecuteCommand(connection, command);
    transactionStarted = true;

    std::string line;
    while (std::getline(sqFile, line, '\n')) {
      lineNumber++;
      if (!line.empty()) {
        command = line;
        commandLine = lineNumber;
        SQLiteOperationResult result = sqliteExecuteCommand(connection, command);
        rowsAffected += result.rowsAffected;
        commands++;
      }
    }

    command = "COMMIT";
    commandLine.reset();
    sqliteExecuteCommand(connection, command);
    transactionStarted = false;
    return {.rowsAffected = rowsAffected, .commands = commands};
  } catch (const std::exception& primaryError) {
    std::string errorContext;
    if (commandLine) {
      errorContext = "line " + std::to_string(*commandLine) + " failed to execute `" + command + "`: " + primaryError.what();
    } else {
      errorContext = "Failed to execute `" + command + "`: " + primaryError.what();
    }

    if (transactionStarted) {
      try {
        sqliteExecuteCommand(connection, "ROLLBACK");
      } catch (const std::exception& rollbackError) {
        errorContext += ". ROLLBACK failed: " + std::string(rollbackError.what());
      }
    }

    throw NitroSQLiteException::CouldNotLoadFile(fileLocation, errorContext);
  }
}

} // namespace margelo::nitro::rnnitrosqlite
