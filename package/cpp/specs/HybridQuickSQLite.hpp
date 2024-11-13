#pragma once

#include "HybridNitroSQLiteSpec.hpp"
#include "HybridNativeQueryResultSpec.hpp"
#include "types.hpp"

using namespace margelo::rnnitrosqlite;

namespace margelo::nitro::rnnitrosqlite {

class HybridNitroSQLite : public HybridNitroSQLiteSpec {
public:
  HybridNitroSQLite() : HybridObject(TAG) {}

public:
    static std::string docPath;

public:
  // Methods
  void open(const std::string& dbName, const std::optional<std::string>& location) override;
  void close(const std::string& dbName) override;
  void drop(const std::string& dbName, const std::optional<std::string>& location) override;
  void attach(const std::string& mainDbName, const std::string& dbNameToAttach, const std::string& alias,
              const std::optional<std::string>& location) override;
  void detach(const std::string& mainDbName, const std::string& alias) override;
  std::shared_ptr<HybridNativeQueryResultSpec> execute(const std::string& dbName, const std::string& query, const std::optional<SQLiteQueryParams>& params) override;
  std::future<std::shared_ptr<HybridNativeQueryResultSpec>> executeAsync(const std::string& dbName, const std::string& query, const std::optional<SQLiteQueryParams>& params) override;
  BatchQueryResult executeBatch(const std::string& dbName, const std::vector<BatchQueryCommand>& commands) override;
  std::future<BatchQueryResult> executeBatchAsync(const std::string& dbName, const std::vector<BatchQueryCommand>& commands) override;
  FileLoadResult loadFile(const std::string& dbName, const std::string& location) override;
  std::future<FileLoadResult> loadFileAsync(const std::string& dbName, const std::string& location) override;
};

inline std::string HybridNitroSQLite::docPath = "";

} // namespace margelo::nitro::rnnitrosqlite
