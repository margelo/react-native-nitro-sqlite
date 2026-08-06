/**
 * SQL File Loader
 * Utilizes the regular sqlite bridge to load an SQLFile inside a transaction
 *
 */

#pragma once

#include "types.hpp"

namespace margelo::nitro::rnnitrosqlite {

SQLiteOperationResult importSqlFile(const std::string& dbName, const std::string& fileLocation);

} // namespace margelo::nitro::rnnitrosqlite
