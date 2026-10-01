/**
 * SQL File Loader
 * Utilizes the regular sqlite bridge to load an SQLFile inside a transaction
 *
 */

#pragma once

#include "NitroSQLiteTypes.hpp"
#include <memory>

namespace margelo::nitro::rnnitrosqlite {

struct SQLiteConnection;

/** Import one nonempty line per statement in an exclusive transaction.
 * Holds the retained connection's lock for the entire import.
 * File and SQL failures throw CouldNotLoadFile with the path and original SQL/line context.
 * Attempts rollback only after BEGIN succeeds; rollback errors are appended.
 */
SQLiteOperationResult importSqlFile(const std::shared_ptr<SQLiteConnection>& connection, const std::string& fileLocation);

} // namespace margelo::nitro::rnnitrosqlite
