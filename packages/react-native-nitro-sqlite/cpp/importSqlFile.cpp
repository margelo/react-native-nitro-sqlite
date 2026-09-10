/**
 * SQL File Loader implementation
 */

#include "importSqlFile.hpp"
#include "NitroSQLiteException.hpp"
#include "operations.hpp"
#include <fstream>
#include <iostream>

namespace margelo::rnnitrosqlite {

SQLiteOperationResult importSqlFile(const std::string& dbName, const std::string& fileLocation) {
  return importSqlFile(sqliteGetOpenDatabase(dbName), fileLocation);
}

SQLiteOperationResult importSqlFile(const SQLiteConnectionPtr& connection, const std::string& fileLocation) {
  std::lock_guard lock(connection->mutex);
  std::string line;
  std::ifstream sqFile(fileLocation);
  if (sqFile.is_open()) {
    try {
      int rowsAffected = 0;
      int commands = 0;
      sqliteExecuteCommand(connection, "BEGIN EXCLUSIVE TRANSACTION");
      while (std::getline(sqFile, line, '\n')) {
        if (!line.empty()) {
          try {
            SQLiteOperationResult result = sqliteExecuteCommand(connection, line);
            rowsAffected += result.rowsAffected;
            commands++;
          } catch (NitroSQLiteException& e) {
            sqliteExecuteCommand(connection, "ROLLBACK");
            sqFile.close();
            throw NitroSQLiteException::CouldNotLoadFile(fileLocation, "Transaction was rolled back");
          }
        }
      }

      sqFile.close();
      sqliteExecuteCommand(connection, "COMMIT");
      return {.rowsAffected = rowsAffected, .commands = commands};
    } catch (...) {
      sqFile.close();
      sqliteExecuteCommand(connection, "ROLLBACK");
      throw NitroSQLiteException(NitroSQLiteExceptionType::UnknownError, "Unexpected error. Transaction was rolled back");
    }
  } else {
    throw NitroSQLiteException::CouldNotLoadFile(fileLocation);
  }
}

} // namespace margelo::rnnitrosqlite
