#pragma once

#include "NitroSQLiteDatabaseConnections.hpp"
#include "hybridObjects/HybridNitroSQLiteQueryResult.hpp"
#include <functional>
#include <memory>
#include <mutex>
#include <queue>
#include <sqlite3.h>
#include <string>

namespace margelo::nitro::rnnitrosqlite {

void sqliteOpenDb(const std::string& dbName, const std::string& docPath, bool readOnly = false);

std::string sqliteOpenConnection(const std::string& dbName, const std::string& docPath, bool readOnly = false);

void sqliteCloseDb(const std::string& dbName);

void sqliteRemoveDb(const std::string& dbName, const std::string& docPath, const std::optional<std::string>& connectionId = std::nullopt,
                    const std::optional<std::string>& otherDocPath = std::nullopt);

void sqliteAttachDb(const std::string& mainDBName, const std::string& docPath, const std::string& databaseToAttach,
                    const std::string& alias);

void sqliteDetachDb(const std::string& mainDBName, const std::string& alias);

SQLiteConnectionPtr sqliteGetOpenDatabase(const std::string& dbName);

std::shared_ptr<HybridNitroSQLiteQueryResult> sqliteExecute(const std::string& dbName, const std::string& query,
                                                            const std::optional<SQLiteQueryParams>& params);
std::shared_ptr<HybridNitroSQLiteQueryResult> sqliteExecute(const SQLiteConnectionPtr& connection, const std::string& query,
                                                            const std::optional<SQLiteQueryParams>& params);

SQLiteOperationResult sqliteExecuteCommand(const std::string& dbName, const std::string& query,
                                           const std::optional<SQLiteQueryParams>& params = std::nullopt);
SQLiteOperationResult sqliteExecuteCommand(const SQLiteConnectionPtr& connection, const std::string& query,
                                           const std::optional<SQLiteQueryParams>& params = std::nullopt);

void sqliteCloseAll();

} // namespace margelo::nitro::rnnitrosqlite
