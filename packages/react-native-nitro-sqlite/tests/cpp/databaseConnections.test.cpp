#include "databaseConnections.hpp"
#include <chrono>
#include <condition_variable>
#include <filesystem>
#include <functional>
#include <future>
#include <iostream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

namespace fs = std::filesystem;
using margelo::rnnitrosqlite::DatabaseConnections;

namespace {

struct QueryGate {
  std::mutex mutex;
  std::condition_variable condition;
  bool entered = false;
  bool release = false;
};

void waitInStatement(sqlite3_context* context, int, sqlite3_value**) {
  auto* gate = static_cast<QueryGate*>(sqlite3_user_data(context));
  std::unique_lock lock(gate->mutex);
  gate->entered = true;
  gate->condition.notify_all();
  gate->condition.wait(lock, [&]() { return gate->release; });
  sqlite3_result_int(context, 1);
}

void expect(bool condition, const std::string& message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

void execute(const margelo::rnnitrosqlite::SQLiteConnectionPtr& connection, const std::string& sql) {
  std::lock_guard lock(connection->mutex);
  char* error = nullptr;
  const int result = sqlite3_exec(connection->database, sql.c_str(), nullptr, nullptr, &error);
  if (result == SQLITE_OK) {
    return;
  }
  const std::string message = error == nullptr ? sqlite3_errmsg(connection->database) : error;
  sqlite3_free(error);
  throw std::runtime_error(message);
}

int scalar(const margelo::rnnitrosqlite::SQLiteConnectionPtr& connection, const std::string& sql) {
  std::lock_guard lock(connection->mutex);
  sqlite3_stmt* statement = nullptr;
  if (sqlite3_prepare_v2(connection->database, sql.c_str(), -1, &statement, nullptr) != SQLITE_OK) {
    throw std::runtime_error(sqlite3_errmsg(connection->database));
  }
  if (sqlite3_step(statement) != SQLITE_ROW) {
    sqlite3_finalize(statement);
    throw std::runtime_error("query returned no row");
  }
  const int value = sqlite3_column_int(statement, 0);
  sqlite3_finalize(statement);
  return value;
}

void expectThrows(const std::function<void()>& action, const std::string& message) {
  try {
    action();
  } catch (const std::exception&) {
    return;
  }
  throw std::runtime_error(message);
}

} // namespace

int main() {
  const auto root = fs::temp_directory_path() /
                    ("nitro-sqlite-connections-" + std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
  fs::create_directories(root);
  try {
    DatabaseConnections registry;
    const auto path = root / "shared.sqlite";
    registry.open("shared.sqlite", path, false);
    const auto first = registry.get("shared.sqlite");
    try {
      registry.drop("shared.sqlite", root / "missing" / "shared.sqlite", std::nullopt);
      throw std::runtime_error("deleting a missing target must fail");
    } catch (const std::exception& error) {
      expect(std::string(error.what()).find("Database file not found") != std::string::npos,
             "a missing target must preserve the existing file-not-found error");
    }
    expect(registry.get("shared.sqlite") == first, "deleting a missing target must preserve the live handle");
    execute(first, "CREATE TABLE values_table (value INTEGER)");
    execute(first, "CREATE TEMP TABLE private_table (value INTEGER)");

    const auto secondId = registry.openIndependent(path, false);
    const auto second = registry.get(secondId);
    expect(secondId.front() == '\0', "independent IDs must not be valid filenames");
    expect(first->database != second->database, "independent opens must use distinct SQLite handles");
    expect(registry.findLivePath(path, root / "migrated.sqlite") == path, "live old path must be reused during migration");
    expectThrows([&]() { execute(second, "SELECT * FROM private_table"); }, "temporary tables must be connection local");
    execute(second, "INSERT INTO values_table VALUES (1)");
    expect(scalar(first, "SELECT COUNT(*) FROM values_table") == 1, "connections should share file data");
    expectThrows([&]() { registry.drop("shared.sqlite", path, secondId); }, "drop must reject a live peer");
    expect(second->database != nullptr, "rejected drop must preserve its own connection");

    registry.close("shared.sqlite");
    expect(first->database == nullptr && second->database != nullptr, "closing one handle must preserve another");
    registry.close(secondId);
    registry.drop("shared.sqlite", path, secondId);
    expect(!fs::exists(path), "closed independent ID should delete its own file");

    registry.open("shared.sqlite", path, false);
    registry.close("shared.sqlite");
    const auto readOnlyId = registry.openIndependent(path, true);
    expectThrows([&]() { execute(registry.get(readOnlyId), "CREATE TABLE forbidden (id INTEGER)"); },
                 "read-only handles must reject writes");
    registry.close(readOnlyId);
    expectThrows([&]() { registry.drop("shared.sqlite", path, readOnlyId); }, "read-only handles must not delete after close");
    expect(fs::exists(path), "read-only drop must preserve the file");
    registry.open("shared.sqlite", path, true);
    expectThrows([&]() { execute(registry.get("shared.sqlite"), "ATTACH DATABASE '" + path.string() + "' AS forbidden"); },
                 "read-only handles must reject writable attachments");
    expectThrows([&]() { registry.drop("shared.sqlite", path, std::nullopt); }, "read-only default handle must not delete its file");
    expect(registry.get("shared.sqlite")->database != nullptr, "rejected read-only drop must preserve its handle");
    registry.close("shared.sqlite");

    const auto attachedPath = root / "attached.sqlite";
    registry.open("attached.sqlite", attachedPath, false);
    registry.close("attached.sqlite");
    registry.open("shared.sqlite", path, false);
    execute(registry.get("shared.sqlite"), "ATTACH DATABASE '" + attachedPath.string() + "' AS other");
    expectThrows([&]() { registry.drop("attached.sqlite", attachedPath, std::nullopt); }, "raw SQL attachment must block deletion");
    expect(fs::exists(attachedPath), "attached database file must survive rejected drop");
    execute(registry.get("shared.sqlite"), "DETACH DATABASE other");
    registry.drop("attached.sqlite", attachedPath, std::nullopt);
    const auto aliasPath = root / "alias.sqlite";
    fs::create_symlink(path, aliasPath);
    const auto aliasId = registry.openIndependent(aliasPath, false);
    expectThrows([&]() { registry.drop("shared.sqlite", path, std::nullopt); }, "a path alias must block deletion of the open file");
    registry.close(aliasId);
    registry.drop("shared.sqlite", path, std::nullopt);

    const auto nestedPath = root / "old" / "nested" / "shared.sqlite";
    fs::create_directories(nestedPath.parent_path());
    const auto nestedId = registry.openIndependent(nestedPath, false);
    expect(registry.findLivePath(nestedPath, root / "new" / "nested" / "shared.sqlite") == nestedPath,
           "live path resolution must retain nested database names");
    registry.drop("shared.sqlite", nestedPath, nestedId);

    const auto concurrentPath = root / "concurrent.sqlite";
    const auto leftId = registry.openIndependent(concurrentPath, false);
    const auto rightId = registry.openIndependent(concurrentPath, false);
    const auto left = registry.get(leftId);
    const auto right = registry.get(rightId);
    execute(left, "CREATE TABLE writes (value INTEGER)");
    sqlite3_busy_timeout(left->database, 5000);
    sqlite3_busy_timeout(right->database, 5000);
    std::vector<std::thread> threads;
    for (const auto& connection : {left, right}) {
      threads.emplace_back([connection]() {
        for (int i = 0; i < 100; i++) {
          execute(connection, "INSERT INTO writes VALUES (1)");
        }
      });
    }
    for (auto& thread : threads) {
      thread.join();
    }
    expect(scalar(left, "SELECT COUNT(*) FROM writes") == 200, "concurrent handles should preserve all writes");
    QueryGate gate;
    expect(sqlite3_create_function_v2(left->database, "block_here", 0, SQLITE_UTF8, &gate, waitInStatement, nullptr, nullptr, nullptr) ==
               SQLITE_OK,
           "failed to register blocking SQLite function");
    auto blocked = std::async(std::launch::async, [&]() { return scalar(left, "SELECT block_here()"); });
    {
      std::unique_lock lock(gate.mutex);
      gate.condition.wait(lock, [&]() { return gate.entered; });
    }
    auto independentQuery = std::async(std::launch::async, [&]() { return scalar(right, "SELECT 42"); });
    const bool ranWhileBlocked = independentQuery.wait_for(std::chrono::seconds(2)) == std::future_status::ready;
    {
      std::lock_guard lock(gate.mutex);
      gate.release = true;
    }
    gate.condition.notify_all();
    expect(blocked.get() == 1, "blocked query returned wrong value");
    expect(independentQuery.get() == 42 && ranWhileBlocked, "a blocked statement must not serialize a second handle");

    execute(left, "PRAGMA journal_mode=WAL");
    execute(right, "BEGIN");
    expect(scalar(right, "SELECT COUNT(*) FROM writes") == 200, "reader snapshot should start at committed data");
    execute(left, "INSERT INTO writes VALUES (1)");
    expect(scalar(right, "SELECT COUNT(*) FROM writes") == 200, "WAL reader should keep its snapshot during another write");
    execute(right, "COMMIT");
    expect(scalar(right, "SELECT COUNT(*) FROM writes") == 201, "reader should see committed data after its transaction");
    registry.close(leftId);
    registry.drop("logical-name.sqlite", concurrentPath, rightId);
    expect(!fs::exists(concurrentPath), "drop must remove the physical filename rather than the logical name");
    const auto missingReadOnlyPath = root / "missing-directory" / "missing.sqlite";
    expectThrows([&]() { registry.openIndependent(missingReadOnlyPath, true); }, "read-only open must reject a missing database");
    expect(!fs::exists(missingReadOnlyPath.parent_path()), "read-only open must not create a directory");
    const std::string invalidName("bad\0name", 8);
    expectThrows([&]() { registry.open(invalidName, root / "bad.sqlite", false); },
                 "default database names containing NUL must be rejected");
    expect(!fs::exists(root / "bad.sqlite"), "invalid default name must not create a database");
    expectThrows([&]() { registry.openIndependent(fs::path(invalidName), false); },
                 "independent database paths containing NUL must be rejected");
    registry.closeAll();
    fs::remove_all(root);
    std::cout << "[PASS] independent connections, lifecycle, attachments, read-only and concurrent writes\n";
    return 0;
  } catch (const std::exception& error) {
    fs::remove_all(root);
    std::cerr << "[FAIL] " << error.what() << '\n';
    return 1;
  }
}
