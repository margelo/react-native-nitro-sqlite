/**
 * SQL File Loader implementation
 */

#include "importSqlFile.hpp"
#include "NitroSQLiteException.hpp"
#include "operations.hpp"
#include <fstream>
#include <iostream>
#include <optional>

namespace margelo::rnnitrosqlite {

SQLiteOperationResult importSqlFile(const std::string& dbName, const std::string& fileLocation) {
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
    sqliteExecuteCommand(dbName, command);
    transactionStarted = true;

    std::string line;
    while (std::getline(sqFile, line, '\n')) {
      lineNumber++;
      if (!line.empty()) {
        command = line;
        commandLine = lineNumber;
        SQLiteOperationResult result = sqliteExecuteCommand(dbName, command);
        rowsAffected += result.rowsAffected;
        commands++;
      }
    }

    command = "COMMIT";
    commandLine.reset();
    sqliteExecuteCommand(dbName, command);
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
        sqliteExecuteCommand(dbName, "ROLLBACK");
      } catch (const std::exception& rollbackError) {
        errorContext += ". ROLLBACK failed: " + std::string(rollbackError.what());
      }
    }

    throw NitroSQLiteException::CouldNotLoadFile(fileLocation, errorContext);
  }
}

} // namespace margelo::rnnitrosqlite
