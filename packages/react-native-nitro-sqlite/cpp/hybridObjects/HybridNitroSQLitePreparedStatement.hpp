#pragma once

#include "HybridNitroSQLitePreparedStatementSpec.hpp"
#include "types.hpp"
#include <memory>

using namespace margelo::rnnitrosqlite;

namespace margelo::rnnitrosqlite {
class SQLitePreparedStatement;
}

namespace margelo::nitro::rnnitrosqlite {

class HybridNitroSQLitePreparedStatement : public HybridNitroSQLitePreparedStatementSpec {
public:
  explicit HybridNitroSQLitePreparedStatement(std::shared_ptr<::margelo::rnnitrosqlite::SQLitePreparedStatement> statement);

  std::shared_ptr<HybridNitroSQLiteQueryResultSpec> execute(const std::optional<SQLiteQueryParams>& params) override;
  std::shared_ptr<Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>>
  executeAsync(const std::optional<SQLiteQueryParams>& params) override;
  void finalize() override;
  bool getIsFinalized() override;

  size_t getExternalMemorySize() noexcept override;

private:
  std::shared_ptr<::margelo::rnnitrosqlite::SQLitePreparedStatement> _statement;
};

} // namespace margelo::nitro::rnnitrosqlite
