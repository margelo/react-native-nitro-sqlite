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
      sqliteExecuteLiteral(dbName, "BEGIN EXCLUSIVE TRANSACTION");
      while (std::getline(sqFile, line, '\n')) {
        if (!line.empty()) {
          try {
            SQLiteOperationResult result = sqliteExecuteLiteral(dbName, line);
            rowsAffected += result.rowsAffected;
            commands++;
          } catch (NitroSQLiteException& e) {
            sqliteExecuteLiteral(dbName, "ROLLBACK");
            sqFile.close();
            throw NitroSQLiteException::CouldNotLoadFile(fileLocation, "Transaction was rolled back");
          }
        }
      }

      sqFile.close();
      sqliteExecuteLiteral(dbName, "COMMIT");
      return {.rowsAffected = rowsAffected, .commands = commands};
    } catch (...) {
      sqFile.close();
      sqliteExecuteLiteral(dbName, "ROLLBACK");
      throw NitroSQLiteException(NitroSQLiteExceptionType::UnknownError, "Unexpected error. Transaction was rolled back");
    }
  } else {
    throw NitroSQLiteException::CouldNotLoadFile(fileLocation);
  }
}

} // namespace margelo::rnnitrosqlite
