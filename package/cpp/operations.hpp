#pragma once

#include "types.hpp"

namespace margelo::rnnitrosqlite {

void sqliteOpenDb(const std::string& dbName, const std::string& docPath);

void sqliteCloseDb(const std::string& dbName);

void sqliteRemoveDb(const std::string& dbName, const std::string& docPath);

void sqliteAttachDb(const std::string& mainDBName, const std::string& docPath, const std::string& databaseToAttach,
                    const std::string& alias);

void sqliteDetachDb(const std::string& mainDBName, const std::string& alias);

SQLiteExecuteQueryResult sqliteExecute(const std::string& dbName, const std::string& query, const std::optional<SQLiteQueryParams>& params);

SQLiteOperationResult sqliteExecuteLiteral(const std::string& dbName, const std::string& query);

void sqliteCloseAll();

} // namespace margelo::rnnitrosqlite
