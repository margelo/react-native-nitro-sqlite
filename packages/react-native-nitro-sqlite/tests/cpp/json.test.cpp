#include "SQLiteJSON.hpp"
#include "sqlite/sqlite3.h"
#include <bit>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <random>
#include <string>
#include <utility>
#include <vector>

using namespace margelo::nitro::rnnitrosqlite;

int main() {
  sqlite3* database = nullptr;
  assert(sqlite3_open(":memory:", &database) == SQLITE_OK);
  sqlite3_stmt* statement = nullptr;
  assert(sqlite3_prepare_v2(database, "SELECT json_valid(?1), json_extract(?1, '$')", -1, &statement, nullptr) == SQLITE_OK);

  std::string controls;
  for (char value = 0; value < 32; value++)
    controls.push_back(value);
  const std::vector<std::string> strings = {
      "", "plain", "quote\" and backslash\\", controls, std::string("a\0b", 3), "café 中 😀", "line\nfeed\rtab\t"};
  for (const auto& value : strings) {
    std::string json;
    assert(appendJSONString(json, value));
    sqlite3_reset(statement);
    assert(sqlite3_bind_text(statement, 1, json.data(), static_cast<int>(json.size()), SQLITE_TRANSIENT) == SQLITE_OK);
    assert(sqlite3_step(statement) == SQLITE_ROW);
    assert(sqlite3_column_int(statement, 0) == 1);
    const auto* text = reinterpret_cast<const char*>(sqlite3_column_text(statement, 1));
    assert(std::string(text, static_cast<size_t>(sqlite3_column_bytes(statement, 1))) == value);
  }

  for (const std::string value : {"\x80", "\xc0\xaf", "\xe0\x80\xaf", "\xed\xa0\x80", "\xf4\x90\x80\x80", "\xff", "\xe2\x82"}) {
    std::string json;
    assert(!appendJSONString(json, value));
  }

  const auto checkNumber = [](double value) {
    std::string json;
    assert(appendJSONNumber(json, value));
    char* end = nullptr;
    const double decoded = std::strtod(json.c_str(), &end);
    assert(end == json.c_str() + json.size());
    assert(std::bit_cast<uint64_t>(decoded) == std::bit_cast<uint64_t>(value));
    // Apple targets use SQLite's formatter instead of floating-point to_chars.
    if (value != 0) {
      char fallback[32];
      sqlite3_snprintf(sizeof(fallback), fallback, "%!.17g", value);
      assert(std::bit_cast<uint64_t>(std::strtod(fallback, nullptr)) == std::bit_cast<uint64_t>(value));
    }
  };
  for (const double value : {0.0, -0.0, 1.0, -1.0, 0.1, std::nextafter(1.0, 2.0), std::numeric_limits<double>::max(),
                             std::numeric_limits<double>::min(), std::numeric_limits<double>::denorm_min()}) {
    checkNumber(value);
  }
  std::mt19937_64 random(42);
  for (int index = 0; index < 10000; index++) {
    const double value = std::bit_cast<double>(random());
    if (std::isfinite(value))
      checkNumber(value);
  }
  const std::vector<std::pair<double, std::string>> integers = {{0.0, "0"},   {-0.0, "-0"},       {1.0, "1"},
                                                                {-1.0, "-1"}, {12345.0, "12345"}, {9007199254740991.0, "9007199254740991"}};
  for (const auto& [value, expected] : integers) {
    std::string json;
    assert(appendJSONNumber(json, value));
    assert(json == expected);
  }

  for (const double value :
       {std::numeric_limits<double>::infinity(), -std::numeric_limits<double>::infinity(), std::numeric_limits<double>::quiet_NaN()}) {
    std::string json = "prefix";
    assert(!appendJSONNumber(json, value));
    assert(json == "prefix");
  }

  for (const int64_t value : {int64_t{0}, int64_t{1}, int64_t{-1}, std::numeric_limits<int64_t>::min(), std::numeric_limits<int64_t>::max(),
                              int64_t{9007199254740993}}) {
    std::string json;
    appendJSONInteger(json, value);
    char* end = nullptr;
    assert(std::strtoll(json.c_str(), &end, 10) == value);
    assert(end == json.c_str() + json.size());
  }

  sqlite3_finalize(statement);
  assert(sqlite3_close(database) == SQLITE_OK);
  std::cout << "[PASS] JSON string escaping and exact finite double round trips\n";
}
