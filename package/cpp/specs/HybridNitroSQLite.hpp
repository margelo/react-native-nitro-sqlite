#pragma once

#include "HybridNitroSQLiteQueryResultSpec.hpp"
#include "HybridNitroSQLiteSpec.hpp"
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

  std::shared_ptr<HybridNitroSQLiteQueryResultSpec> execute(const std::string& dbName, const std::string& query,
                                                            const std::optional<SQLiteQueryParams>& params) override;

  std::shared_ptr<Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>>
  executeAsync(const std::string& dbName, const std::string& query, const std::optional<SQLiteQueryParams>& params) override;

  BatchQueryResult executeBatch(const std::string& dbName, const std::vector<BatchQueryCommand>& commands) override;
  std::shared_ptr<Promise<BatchQueryResult>> executeBatchAsync(const std::string& dbName,
                                                               const std::vector<BatchQueryCommand>& commands) override;

  FileLoadResult loadFile(const std::string& dbName, const std::string& location) override;
  std::shared_ptr<Promise<FileLoadResult>> loadFileAsync(const std::string& dbName, const std::string& location) override;

  /**
   * Approximate the native memory used by this Hybrid Object.
   *
   * This object itself does not own any large external resources – database
   * connections are handled by the shared `dbMap` in `operations.cpp`.
   * We still report the size of this C++ instance so the JS GC can account
   * for the object when it is retained from JS.
   */
  size_t getExternalMemorySize() noexcept override;
};

inline std::string HybridNitroSQLite::docPath = "";

} // namespace margelo::nitro::rnnitrosqlite
