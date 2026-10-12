#include "NitroSQLiteStatementCache.hpp"
#include <iostream>
#include <stdexcept>
#include <string>

using margelo::nitro::rnnitrosqlite::SQLiteStatementCache;

namespace {

void expect(bool condition, const std::string& message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

sqlite3_stmt* prepare(sqlite3* db, const std::string& sql) {
  sqlite3_stmt* statement = nullptr;
  if (sqlite3_prepare_v2(db, sql.c_str(), -1, &statement, nullptr) != SQLITE_OK) {
    throw std::runtime_error(sqlite3_errmsg(db));
  }
  return statement;
}

int liveStatements(sqlite3* db) {
  int count = 0;
  for (sqlite3_stmt* statement = sqlite3_next_stmt(db, nullptr); statement != nullptr; statement = sqlite3_next_stmt(db, statement)) {
    count++;
  }
  return count;
}

} // namespace

int main() {
  sqlite3* db = nullptr;
  try {
    for (const char* sql : {"SELECT 1", "  select * FROM t", "insert into t VALUES (1)", "UPDATE t SET a = 1", "DELETE FROM t",
                            "REPLACE INTO t VALUES (1)", "WITH x AS (SELECT 1) SELECT * FROM x", "VALUES (1)",
                            "-- leading comment\nSELECT 1", "/* block */ SELECT 1", "\n\t/* a */ -- b\n insert INTO t VALUES (2)"}) {
      expect(SQLiteStatementCache::isCacheable(sql), std::string("expected cacheable: ") + sql);
    }
    for (const char* sql :
         {"PRAGMA cache_size = 100", "BEGIN", "COMMIT", "ROLLBACK", "ATTACH DATABASE 'a' AS a", "DETACH a", "CREATE TABLE t (a)",
          "DROP TABLE t", "VACUUM", "SAVEPOINT s", "", "   ", "-- only a comment", "/* unterminated", "SELECTED", "1"}) {
      expect(!SQLiteStatementCache::isCacheable(sql), std::string("expected not cacheable: ") + sql);
    }

    if (sqlite3_open(":memory:", &db) != SQLITE_OK) {
      throw std::runtime_error("cannot open an in-memory database");
    }
    {
      SQLiteStatementCache cache;
      expect(cache.take("SELECT 1") == nullptr, "an empty cache has no statements");

      sqlite3_stmt* first = prepare(db, "SELECT 1");
      cache.put("SELECT 1", first);
      expect(cache.take("SELECT 1") == first, "a cached statement is returned for the same SQL");
      expect(cache.take("SELECT 1") == nullptr, "a taken statement leaves the cache");

      // A returned statement runs again with new bindings.
      sqlite3_stmt* bound = prepare(db, "SELECT ?");
      sqlite3_bind_int(bound, 1, 7);
      expect(sqlite3_step(bound) == SQLITE_ROW && sqlite3_column_int(bound, 0) == 7, "first execution");
      sqlite3_reset(bound);
      sqlite3_clear_bindings(bound);
      cache.put("SELECT ?", bound);
      sqlite3_stmt* reused = cache.take("SELECT ?");
      sqlite3_bind_int(reused, 1, 9);
      expect(sqlite3_step(reused) == SQLITE_ROW && sqlite3_column_int(reused, 0) == 9, "reused execution sees new bindings");
      sqlite3_reset(reused);
      cache.put("SELECT ?", reused);

      // A second statement for SQL that is already cached is finalized instead of replacing it.
      cache.put("SELECT 1", first);
      cache.put("SELECT 1", prepare(db, "SELECT 1"));
      expect(cache.take("SELECT 1") == first, "the cached statement is kept when a duplicate is returned");
      cache.put("SELECT 1", first);

      cache.clear();
      expect(liveStatements(db) == 0, "clear finalizes every cached statement");

      // The least recently used statement is finalized once the cache is full.
      for (size_t i = 0; i <= SQLiteStatementCache::kCapacity; i++) {
        const std::string sql = "SELECT " + std::to_string(i);
        cache.put(sql, prepare(db, sql));
      }
      expect(liveStatements(db) == static_cast<int>(SQLiteStatementCache::kCapacity), "the cache never exceeds its capacity");
      expect(cache.take("SELECT 0") == nullptr, "the least recently used statement is evicted");
      sqlite3_stmt* newest = cache.take("SELECT " + std::to_string(SQLiteStatementCache::kCapacity));
      expect(newest != nullptr, "the most recently used statement stays cached");
      sqlite3_finalize(newest);
    }
    expect(liveStatements(db) == 0, "destroying the cache finalizes its statements");
    sqlite3_close(db);
    std::cout << "[PASS] statement cache classification, reuse, eviction and cleanup\n";
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "[FAIL] " << error.what() << '\n';
    if (db != nullptr) {
      sqlite3_close_v2(db);
    }
    return 1;
  }
}
