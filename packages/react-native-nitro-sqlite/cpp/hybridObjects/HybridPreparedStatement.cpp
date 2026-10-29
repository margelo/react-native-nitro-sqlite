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

NativeQueryResult HybridPreparedStatement::execute(const std::optional<SQLiteQueryParams>& params) {
  return _statement->execute(params);
}

Promise<NativeQueryResult> HybridPreparedStatement::executeAsync(const std::optional<SQLiteQueryParams>& params) {
  auto copiedParams = copyArrayBufferParamsForBackground(params);

  return Promise<NativeQueryResult>::async(
      [statement = _statement, copiedParams = std::move(copiedParams)]() -> NativeQueryResult { return statement->execute(copiedParams); });
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
