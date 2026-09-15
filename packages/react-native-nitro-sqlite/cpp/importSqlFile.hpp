/**
 * SQL File Loader
 * Utilizes the regular sqlite bridge to load an SQLFile inside a transaction
 *
 */

#pragma once

#include "types.hpp"
#include <memory>

namespace margelo::rnnitrosqlite {

struct SQLiteConnection;

SQLiteOperationResult importSqlFile(const std::string& dbName, const std::string& fileLocation);
SQLiteOperationResult importSqlFile(const std::shared_ptr<SQLiteConnection>& connection, const std::string& fileLocation);

} // namespace margelo::rnnitrosqlite
