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
  std::string line;
  std::ifstream sqFile(fileLocation);
  if (sqFile.is_open()) {
    try {
      int rowsAffected = 0;
      int commands = 0;
      sqliteExecuteCommand(dbName, "BEGIN EXCLUSIVE TRANSACTION");
      while (std::getline(sqFile, line, '\n')) {
        if (!line.empty()) {
          try {
            SQLiteOperationResult result = sqliteExecuteCommand(dbName, line);
            rowsAffected += result.rowsAffected;
            commands++;
          } catch (NitroSQLiteException& e) {
            sqliteExecuteCommand(dbName, "ROLLBACK");
            sqFile.close();
            throw NitroSQLiteException::CouldNotLoadFile(fileLocation, "Transaction was rolled back");
          }
        }
      }

      sqFile.close();
      sqliteExecuteCommand(dbName, "COMMIT");
      return {.rowsAffected = rowsAffected, .commands = commands};
    } catch (...) {
      sqFile.close();
      sqliteExecuteCommand(dbName, "ROLLBACK");
      throw NitroSQLiteException(NitroSQLiteExceptionType::UnknownError, "Unexpected error. Transaction was rolled back");
    }
  } else {
    throw NitroSQLiteException::CouldNotLoadFile(fileLocation);
  }
}

} // namespace margelo::rnnitrosqlite
