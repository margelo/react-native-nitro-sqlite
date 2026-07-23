#include "HybridNitroSQLitePreparedStatement.hpp"
#include "HybridNitroSQLiteQueryResult.hpp"
#include "operations.hpp"
#include <NitroModules/ArrayBuffer.hpp>

namespace margelo::nitro::rnnitrosqlite {

namespace {

  std::optional<SQLiteQueryParams> copyArrayBufferParamsForBackground(const std::optional<SQLiteQueryParams>& params) {
    if (!params) {
      return std::nullopt;
    }

    SQLiteQueryParams copiedParams;
    copiedParams.reserve(params->size());

    for (const auto& value : *params) {
      if (std::holds_alternative<std::shared_ptr<ArrayBuffer>>(value)) {
        copiedParams.push_back(ArrayBuffer::copy(std::get<std::shared_ptr<ArrayBuffer>>(value)));
      } else {
        copiedParams.push_back(value);
      }
    }

    return copiedParams;
  }

} // namespace

HybridNitroSQLitePreparedStatement::HybridNitroSQLitePreparedStatement(
    std::shared_ptr<::margelo::rnnitrosqlite::SQLitePreparedStatement> statement)
    : HybridObject(TAG), _statement(std::move(statement)) {}

std::shared_ptr<HybridNitroSQLiteQueryResultSpec>
HybridNitroSQLitePreparedStatement::execute(const std::optional<SQLiteQueryParams>& params) {
  return _statement->execute(params);
}

std::shared_ptr<Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>>
HybridNitroSQLitePreparedStatement::executeAsync(const std::optional<SQLiteQueryParams>& params) {
  const auto copiedParams = copyArrayBufferParamsForBackground(params);
  const auto statement = _statement;

  return Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>::async(
      [statement, copiedParams]() -> std::shared_ptr<HybridNitroSQLiteQueryResultSpec> { return statement->execute(copiedParams); });
}

void HybridNitroSQLitePreparedStatement::finalize() {
  _statement->finalize();
}

bool HybridNitroSQLitePreparedStatement::getIsFinalized() {
  return _statement->isFinalized();
}

size_t HybridNitroSQLitePreparedStatement::getExternalMemorySize() noexcept {
  return sizeof(*this) + _statement->getExternalMemorySize();
}

} // namespace margelo::nitro::rnnitrosqlite
