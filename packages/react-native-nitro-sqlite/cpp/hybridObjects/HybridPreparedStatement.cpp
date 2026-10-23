#include "HybridPreparedStatement.hpp"
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
      if (value && std::holds_alternative<ArrayBuffer>(*value)) {
        copiedParams.push_back(ArrayBuffer::copy(std::get<ArrayBuffer>(*value)));
      } else {
        copiedParams.push_back(value);
      }
    }

    return copiedParams;
  }

} // namespace

HybridPreparedStatement::HybridPreparedStatement(std::shared_ptr<SQLitePreparedStatement> statement) : _statement(std::move(statement)) {}

NitroSQLiteQueryResult HybridPreparedStatement::execute(const std::optional<SQLiteQueryParams>& params) {
  return _statement->execute(params);
}

Promise<NitroSQLiteQueryResult> HybridPreparedStatement::executeAsync(const std::optional<SQLiteQueryParams>& params) {
  const auto copiedParams = copyArrayBufferParamsForBackground(params);
  const auto statement = _statement;

  return Promise<NitroSQLiteQueryResult>::async(
      [statement, copiedParams]() -> NitroSQLiteQueryResult { return statement->execute(copiedParams); });
}

void HybridPreparedStatement::finalize() {
  _statement->finalize();
}

bool HybridPreparedStatement::getIsFinalized() {
  return _statement->isFinalized();
}

size_t HybridPreparedStatement::getExternalMemorySize() noexcept {
  return sizeof(*this) + _statement->getExternalMemorySize();
}

} // namespace margelo::nitro::rnnitrosqlite
