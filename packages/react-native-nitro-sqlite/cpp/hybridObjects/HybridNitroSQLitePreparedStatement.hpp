#pragma once

#include "../NitroSQLiteOperations.hpp"
#include "../NitroSQLiteTypes.hpp"
#include "HybridNitroSQLitePreparedStatementSpec.hpp"
#include <memory>

namespace margelo::nitro::rnnitrosqlite {

/** Nitro hybrid object for a reusable native SQLite statement. */
class HybridNitroSQLitePreparedStatement : public HybridNitroSQLitePreparedStatementSpec {
public:
  /** Wrap a prepared statement for calls from JavaScript. */
  explicit HybridNitroSQLitePreparedStatement(std::shared_ptr<SQLitePreparedStatement> statement);

  /** Execute with new bindings on the calling thread. */
  std::shared_ptr<HybridNitroSQLiteQueryResultSpec> execute(const std::optional<SQLiteQueryParams>& params) override;
  /** Execute with new bindings on a background thread. */
  std::shared_ptr<Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>>
  executeAsync(const std::optional<SQLiteQueryParams>& params) override;
  /** Release the native statement. */
  void finalize() override;
  /** Check whether the native statement has been released. */
  bool getIsFinalized() override;

  /** Report native memory used by this hybrid object. */
  size_t getExternalMemorySize() noexcept override;

private:
  std::shared_ptr<SQLitePreparedStatement> _statement;
};

} // namespace margelo::nitro::rnnitrosqlite
