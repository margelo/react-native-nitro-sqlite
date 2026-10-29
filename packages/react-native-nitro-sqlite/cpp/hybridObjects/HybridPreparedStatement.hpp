#pragma once

#include "../SQLiteOperations.hpp"
#include "../SQLiteTypes.hpp"
#include <RNNitroSQLite/HybridPreparedStatementSpec.hpp>
#include <memory>

namespace margelo::nitro::rnnitrosqlite {

/** Nitro hybrid object for a reusable native SQLite statement. */
class HybridPreparedStatement : public HybridPreparedStatementSpec {
public:
  /** Wrap a prepared statement for calls from JavaScript. */
  explicit HybridPreparedStatement(std::shared_ptr<SQLitePreparedStatement> statement);

  /** Execute with new bindings on the calling thread. */
  NativeQueryResult execute(const std::optional<SQLiteQueryParams>& params) override;
  /** Execute with new bindings on a background thread. */
  Promise<NativeQueryResult> executeAsync(const std::optional<SQLiteQueryParams>& params) override;
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
