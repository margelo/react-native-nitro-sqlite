#include <vector>
#include <string>
#include <iostream>
#include "HybridQuickSQLiteObject.hpp"
#include "sqliteBridge.h"
#include "logs.h"
#include "ThreadPool.h"
#include "sqlfileloader.h"
#include "sqlbatchexecutor.h"
#include "macros.h"
#include "OnLoad.hpp"
#include "QueryType.hpp"
#include "Types.hpp"

using namespace margelo::nitro;

namespace margelo::rnquicksqlite {

void HybridQuickSQLiteObject::open(const std::string& dbName, const std::optional<std::string>& location) {
    std::string tempDocPath = std::string(docPathStr);
    if (location) {
        tempDocPath = tempDocPath + "/" + *location;
    }

    SQLiteOPResult result = sqliteOpenDb(dbName, tempDocPath);

    if (result.type == SQLiteError)
    {
        throw std::runtime_error(result.errorMessage.c_str());
    }
}

void HybridQuickSQLiteObject::close(const std::string& dbName) {
    SQLiteOPResult result = sqliteCloseDb(dbName);

    if (result.type == SQLiteError)
    {
        throw std::runtime_error(result.errorMessage.c_str());
    }
};

void HybridQuickSQLiteObject::drop(const std::string& dbName, const std::optional<std::string>& location) {
    std::string tempDocPath = std::string(docPathStr);
    if (location)
    {
        tempDocPath = tempDocPath + "/" + *location;
    }


    SQLiteOPResult result = sqliteRemoveDb(dbName, tempDocPath);

    if (result.type == SQLiteError)
    {
        throw std::runtime_error(result.errorMessage.c_str());
    }
};

void HybridQuickSQLiteObject::attach(const std::string& mainDbName, const std::string& dbNameToAttach, const std::string& alias, const std::optional<std::string>& location) {
    std::string tempDocPath = std::string(docPathStr);
    if (location)
    {
        tempDocPath = tempDocPath + "/" + *location;
    }

    SQLiteOPResult result = sqliteAttachDb(mainDbName, tempDocPath, dbNameToAttach, alias);

    if (result.type == SQLiteError)
    {
        throw std::runtime_error(result.errorMessage.c_str());
    }
};

void HybridQuickSQLiteObject::detach(const std::string& mainDbName, const std::string& alias) {
    SQLiteOPResult result = sqliteDetachDb(mainDbName, alias);

    if (result.type == SQLiteError)
    {
        throw std::runtime_error(result.errorMessage.c_str());
    }
};

std::future<void> transaction(const std::string& dbName, const std::function<std::future<std::future<void>>(const Transaction& /* tx */)>& fn) {
    return std::async(std::launch::async, []() {

    });
};

QueryResult HybridQuickSQLiteObject::execute(const std::string& dbName, const std::string& query, const std::optional<std::vector<ExecuteParam>>& params) {
    std::vector<std::map<std::string, SQLiteValue>> results;
    std::vector<ColumnMetadata> metadata;

    // Converting results into a JSI Response
    try {
        auto status = sqliteExecute(dbName, query, params, &results, &metadata);

        if(status.type == SQLiteError) {
          throw std::runtime_error(status.errorMessage.c_str());
        }

        QueryResult result(QueryType::SELECT, std::nullopt, 0, std::nullopt);
        return result;
    } catch(std::exception &e) {
        throw std::runtime_error(e.what());
    }
};

std::future<QueryResult> HybridQuickSQLiteObject::executeAsync(const std::string& dbName, const std::string& query, const std::optional<std::vector<ExecuteParam>>& params) {
    std::promise<QueryResult> promise;
    auto future = promise.get_future();

    auto task = [this, prom = std::move(promise), dbName, query, params]() mutable {
        try {
            auto result = execute(dbName, query, params);
            prom.set_value(result);
        } catch (...) {
            prom.set_exception(std::current_exception());
        }
    };

    pool->queueWork(std::move(task));

    return future;
};

BatchQueryResult HybridQuickSQLiteObject::executeBatch(const std::string& dbName, const std::vector<BatchQueryCommand>& batchParams) {
    const auto commands = batchParamsToCommands(batchParams);

    auto batchResult = sqliteExecuteBatch(dbName, commands);
    if (batchResult.type == SQLiteOk)
    {
        return BatchQueryResult(batchResult.affectedRows);
    }
    else
    {
        throw std::runtime_error(batchResult.message);
    }
};

std::future<BatchQueryResult> HybridQuickSQLiteObject::executeBatchAsync(const std::string& dbName, const std::vector<BatchQueryCommand>& batchParams) {
    std::promise<BatchQueryResult> promise;
    auto future = promise.get_future();

    auto task = [this, prom = std::move(promise), dbName, batchParams]() mutable {
        try {
            auto result = executeBatch(dbName, batchParams);
            prom.set_value(result);
        } catch (...) {
            prom.set_exception(std::current_exception());
        }
    };

    pool->queueWork(std::move(task));

    return future;
};

FileLoadResult HybridQuickSQLiteObject::loadFile(const std::string& dbName, const std::string& location) {
    const auto importResult = importSQLFile(dbName, location);
    if (importResult.type == SQLiteOk)
    {
        auto result = new FileLoadResult(importResult.commands, importResult.affectedRows);
        return *result;
    }
    else
    {
        throw std::runtime_error("[react-native-quick-sqlite][loadFile] Could not open file");
    }
};

std::future<FileLoadResult> HybridQuickSQLiteObject::loadFileAsync(const std::string& dbName, const std::string& location) {
    std::promise<FileLoadResult> promise;
    auto future = promise.get_future();

    auto task = [this, prom = std::move(promise), dbName, location]() mutable {
        try {
            auto result = loadFile(dbName, location);
            prom.set_value(result);
        } catch (...) {
            prom.set_exception(std::current_exception());
        }
    };

    pool->queueWork(std::move(task));

    return future;
};

}