#pragma once

#include "sqlite/sqlite3.h"
#include <cctype>
#include <list>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>

namespace margelo::nitro::rnnitrosqlite {

/** Least recently used prepared statements of one connection, keyed by SQL text.
 * Callers hold the connection's mutex. Cached statements are always reset with cleared bindings.
 */
class SQLiteStatementCache final {
public:
  static constexpr size_t kCapacity = 32;

  SQLiteStatementCache() = default;
  ~SQLiteStatementCache() {
    clear();
  }

  SQLiteStatementCache(const SQLiteStatementCache&) = delete;
  SQLiteStatementCache& operator=(const SQLiteStatementCache&) = delete;

  /** Whether reusing a statement for @p sql is equivalent to preparing it again.
   * Only queries and data changes qualify. Statements such as PRAGMA, ATTACH, or BEGIN can apply
   * their effect while SQLite prepares them, so they are always prepared anew.
   */
  static bool isCacheable(std::string_view sql) {
    const std::string_view keyword = firstKeyword(sql);
    for (const std::string_view cacheable : {"SELECT", "INSERT", "UPDATE", "DELETE", "REPLACE", "WITH", "VALUES"}) {
      if (equalsIgnoringCase(keyword, cacheable)) {
        return true;
      }
    }
    return false;
  }

  /** Remove and return the statement cached for @p sql, or nullptr if there is none. */
  sqlite3_stmt* take(const std::string& sql) {
    const auto found = _index.find(sql);
    if (found == _index.end()) {
      return nullptr;
    }
    sqlite3_stmt* statement = found->second->second;
    _entries.erase(found->second);
    _index.erase(found);
    return statement;
  }

  /** Cache a reset statement for @p sql, finalizing the least recently used one when full. */
  void put(const std::string& sql, sqlite3_stmt* statement) {
    if (const auto found = _index.find(sql); found != _index.end()) {
      sqlite3_finalize(statement);
      return;
    }
    if (_entries.size() == kCapacity) {
      sqlite3_finalize(_entries.back().second);
      _index.erase(_entries.back().first);
      _entries.pop_back();
    }
    _entries.emplace_front(sql, statement);
    _index.emplace(_entries.front().first, _entries.begin());
  }

  /** Finalize every cached statement. Call before closing the connection. */
  void clear() noexcept {
    for (const auto& entry : _entries) {
      sqlite3_finalize(entry.second);
    }
    _index.clear();
    _entries.clear();
  }

private:
  using Entries = std::list<std::pair<std::string, sqlite3_stmt*>>;

  // Skips whitespace and SQL comments, then returns the leading run of letters.
  static std::string_view firstKeyword(std::string_view sql) {
    size_t position = 0;
    while (position < sql.size()) {
      if (std::isspace(static_cast<unsigned char>(sql[position]))) {
        position++;
      } else if (sql.substr(position, 2) == "--") {
        const size_t lineEnd = sql.find('\n', position);
        position = lineEnd == std::string_view::npos ? sql.size() : lineEnd + 1;
      } else if (sql.substr(position, 2) == "/*") {
        const size_t commentEnd = sql.find("*/", position + 2);
        position = commentEnd == std::string_view::npos ? sql.size() : commentEnd + 2;
      } else {
        break;
      }
    }
    size_t end = position;
    while (end < sql.size() && std::isalpha(static_cast<unsigned char>(sql[end]))) {
      end++;
    }
    return sql.substr(position, end - position);
  }

  static bool equalsIgnoringCase(std::string_view value, std::string_view upperCase) {
    if (value.size() != upperCase.size()) {
      return false;
    }
    for (size_t i = 0; i < value.size(); i++) {
      if (std::toupper(static_cast<unsigned char>(value[i])) != upperCase[i]) {
        return false;
      }
    }
    return true;
  }

  Entries _entries;
  std::unordered_map<std::string_view, Entries::iterator> _index;
};

} // namespace margelo::nitro::rnnitrosqlite
