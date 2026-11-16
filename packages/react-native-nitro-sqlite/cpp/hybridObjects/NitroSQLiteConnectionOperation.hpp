#pragma once

#include "../NitroSQLiteDatabaseConnections.hpp"
#include <NitroModules/Promise.hpp>
#include <exception>
#include <memory>
#include <optional>
#include <utility>

namespace margelo::nitro::rnnitrosqlite {

/** Run @p operation on the connection's FIFO worker and settle the returned promise with its result.
 * Calls on one connection run in submission order, one at a time.
 */
template <typename Result, typename Operation>
std::shared_ptr<Promise<Result>> enqueueConnectionOperation(const SQLiteConnectionPtr& connection, Operation&& operation) {
  auto promise = Promise<Result>::create();
  try {
    connection->enqueueAsync([promise, operation = std::forward<Operation>(operation)]() mutable {
      std::optional<Result> result;
      try {
        result.emplace(operation());
      } catch (...) {
        promise->reject(std::current_exception());
        return;
      }
      // Resolving may dispatch to JavaScript and throw after the native promise
      // has settled. Do not try to reject that same promise again.
      try {
        promise->resolve(std::move(*result));
      } catch (...) {
        if (promise->isPending()) {
          promise->reject(std::current_exception());
          return;
        }
        throw;
      }
    });
  } catch (...) {
    promise->reject(std::current_exception());
  }
  return promise;
}

} // namespace margelo::nitro::rnnitrosqlite
