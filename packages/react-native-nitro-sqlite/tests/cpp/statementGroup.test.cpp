#include "NitroSQLiteStatementGroup.hpp"
#include <iostream>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

using margelo::nitro::rnnitrosqlite::executeStatementGroup;

namespace {

struct FinalizeStatement {
  void operator()(sqlite3_stmt* statement) const noexcept {
    sqlite3_finalize(statement);
  }
};

using Statement = std::unique_ptr<sqlite3_stmt, FinalizeStatement>;
using Params = std::vector<std::optional<int>>;

void fail(sqlite3* db) {
  throw std::runtime_error(sqlite3_errmsg(db));
}

void expect(bool condition, const char* message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

int countInsertPreparations(void* context, int action, const char*, const char*, const char*, const char*) {
  if (action == SQLITE_INSERT) {
    ++*static_cast<int*>(context);
  }
  return SQLITE_OK;
}

std::pair<int, int> insertGroup(sqlite3* db, const std::vector<Params>& parameterSets) {
  return executeStatementGroup(
      db, "INSERT INTO batch_values (id, value) VALUES (?, ?)", parameterSets,
      [](sqlite3* database, const std::string& sql) {
        sqlite3_stmt* raw = nullptr;
        const int status = sqlite3_prepare_v2(database, sql.c_str(), -1, &raw, nullptr);
        Statement statement(raw);
        if (status != SQLITE_OK) {
          fail(database);
        }
        return statement;
      },
      [](sqlite3_stmt* statement, const Params& params) {
        for (size_t index = 0; index < params.size(); index++) {
          const int status = params[index] ? sqlite3_bind_int(statement, static_cast<int>(index + 1), *params[index])
                                           : sqlite3_bind_null(statement, static_cast<int>(index + 1));
          if (status != SQLITE_OK) {
            fail(sqlite3_db_handle(statement));
          }
        }
      },
      [](sqlite3* database, sqlite3_stmt* statement) {
        int status;
        while ((status = sqlite3_step(statement)) == SQLITE_ROW) {
        }
        if (status != SQLITE_DONE) {
          fail(database);
        }
      },
      fail);
}

int scalar(sqlite3* db, const char* sql) {
  sqlite3_stmt* raw = nullptr;
  if (sqlite3_prepare_v2(db, sql, -1, &raw, nullptr) != SQLITE_OK) {
    fail(db);
  }
  Statement statement(raw);
  if (sqlite3_step(statement.get()) != SQLITE_ROW) {
    fail(db);
  }
  return sqlite3_column_int(statement.get(), 0);
}

} // namespace

int main() {
  sqlite3* raw = nullptr;
  if (sqlite3_open(":memory:", &raw) != SQLITE_OK) {
    return 1;
  }
  std::unique_ptr<sqlite3, decltype(&sqlite3_close)> db(raw, sqlite3_close);
  try {
    expect(sqlite3_exec(db.get(), "CREATE TABLE batch_values (id INTEGER PRIMARY KEY, value INTEGER)", nullptr, nullptr, nullptr) ==
               SQLITE_OK,
           "failed to create test table");

    int preparations = 0;
    expect(sqlite3_set_authorizer(db.get(), countInsertPreparations, &preparations) == SQLITE_OK, "failed to set authorizer");
    expect(insertGroup(db.get(), {{1, 9}, {2}, {3, std::nullopt}}) == std::pair(3, 3), "wrong group result");
    expect(preparations == 1, "three parameter sets should prepare once");
    expect(insertGroup(db.get(), {}) == std::pair(0, 0), "empty group should execute nothing");
    expect(preparations == 1, "empty group should not prepare");
    expect(insertGroup(db.get(), {{4, 8}}) == std::pair(1, 1), "second group result is wrong");
    expect(preparations == 2, "a second group should prepare separately");

    sqlite3_set_authorizer(db.get(), nullptr, nullptr);
    expect(scalar(db.get(), "SELECT COUNT(*) FROM batch_values WHERE value IS NULL") == 2, "short bindings carried over");
    expect(scalar(db.get(), "SELECT COUNT(*) FROM batch_values") == 4, "wrong row count");

    try {
      insertGroup(db.get(), {{5, 1}, {5, 2}});
      throw std::runtime_error("duplicate key should fail");
    } catch (const std::runtime_error& error) {
      expect(std::string(error.what()) != "duplicate key should fail", "duplicate key did not fail");
    }
    expect(sqlite3_next_stmt(db.get(), nullptr) == nullptr, "failed group leaked its prepared statement");
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "[FAIL] " << error.what() << '\n';
    return 1;
  }
}
