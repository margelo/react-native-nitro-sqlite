#include "NitroSQLiteStatementTail.hpp"
#include <iostream>
#include <memory>
#include <stdexcept>
#include <string>

using margelo::nitro::rnnitrosqlite::hasTrailingStatement;

namespace {

void expect(bool condition, const std::string& message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

bool queryHasTrailingStatement(sqlite3* db, const std::string& query) {
  sqlite3_stmt* raw = nullptr;
  const char* tail = nullptr;
  if (sqlite3_prepare_v2(db, query.c_str(), -1, &raw, &tail) != SQLITE_OK) {
    throw std::runtime_error(sqlite3_errmsg(db));
  }
  std::unique_ptr<sqlite3_stmt, decltype(&sqlite3_finalize)> statement(raw, sqlite3_finalize);
  expect(statement != nullptr, "query should contain a statement: " + query);
  return hasTrailingStatement(db, tail);
}

} // namespace

int main() {
  sqlite3* raw = nullptr;
  if (sqlite3_open(":memory:", &raw) != SQLITE_OK) {
    return 1;
  }
  std::unique_ptr<sqlite3, decltype(&sqlite3_close)> db(raw, sqlite3_close);
  try {
    for (const std::string query : {
             "SELECT 1",
             "SELECT 1;",
             "SELECT 1;\n  ",
             "SELECT 1;;;",
             "SELECT 1; -- trailing comment",
             "SELECT 1; /* trailing comment */",
             "SELECT 1; /* unterminated comment",
         }) {
      expect(!queryHasTrailingStatement(db.get(), query), "single statement was rejected: " + query);
    }

    for (const std::string query : {
             "CREATE TABLE foo (id INTEGER); CREATE TABLE bar (id INTEGER);",
             "SELECT 1; SELECT 2",
             "SELECT 1; -- comment\nSELECT 2",
             // The second statement cannot prepare before the first one runs.
             "CREATE TABLE later (id INTEGER); INSERT INTO later VALUES (1)",
             "SELECT 1; not valid SQL",
         }) {
      expect(queryHasTrailingStatement(db.get(), query), "trailing statement was not detected: " + query);
    }

    expect(!hasTrailingStatement(db.get(), nullptr), "a missing tail should not be rejected");
    expect(sqlite3_next_stmt(db.get(), nullptr) == nullptr, "tail check leaked a prepared statement");
    std::cout << "[PASS] detects SQL after the first statement" << '\n';
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "[FAIL] " << error.what() << '\n';
    return 1;
  }
}
