#pragma once

#include "../NitroSQLiteOperations.hpp"
#include "../NitroSQLiteTypes.hpp"
#include "HybridNitroSQLitePreparedStatementSpec.hpp"
#include <memory>

namespace margelo::nitro::rnnitrosqlite {

class HybridNitroSQLitePreparedStatement : public HybridNitroSQLitePreparedStatementSpec {
public:
  explicit HybridNitroSQLitePreparedStatement(std::shared_ptr<SQLitePreparedStatement> statement);

  std::shared_ptr<HybridNitroSQLiteQueryResultSpec> execute(const std::optional<SQLiteQueryParams>& params) override;
  std::shared_ptr<Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>>
  executeAsync(const std::optional<SQLiteQueryParams>& params) override;
  void finalize() override;
  bool getIsFinalized() override;

  size_t getExternalMemorySize() noexcept override;

private:
  std::shared_ptr<SQLitePreparedStatement> _statement;
};

} // namespace margelo::nitro::rnnitrosqlite
