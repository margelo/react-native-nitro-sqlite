#include "SQLiteJSON.hpp"
#include "sqlite/sqlite3.h"
#include <charconv>
#include <cmath>
#include <stdexcept>

#if defined(__APPLE__)
#include <dlfcn.h>
#endif

namespace margelo::nitro::rnnitrosqlite {

#if defined(__APPLE__)
namespace {
  using DoubleToChars = std::to_chars_result (*)(char*, char*, double);
  DoubleToChars appleDoubleToChars();
} // namespace
#endif

bool appendJSONString(std::string& json, std::string_view value) {
  constexpr char hex[] = "0123456789abcdef";
  json.push_back('"');
  size_t start = 0;
  for (size_t index = 0; index < value.size(); index++) {
    const auto character = static_cast<unsigned char>(value[index]);
    if (character >= 0x80) {
      const size_t length = character >= 0xc2 && character <= 0xdf   ? 2
                            : character >= 0xe0 && character <= 0xef ? 3
                            : character >= 0xf0 && character <= 0xf4 ? 4
                                                                     : 0;
      if (length == 0 || index + length > value.size())
        return false;
      const auto second = static_cast<unsigned char>(value[index + 1]);
      if ((character == 0xe0 && second < 0xa0) || (character == 0xed && second >= 0xa0) || (character == 0xf0 && second < 0x90) ||
          (character == 0xf4 && second >= 0x90))
        return false;
      for (size_t offset = 1; offset < length; offset++) {
        if ((static_cast<unsigned char>(value[index + offset]) & 0xc0) != 0x80)
          return false;
      }
      index += length - 1;
      continue;
    }
    if (character >= 0x20 && character != '"' && character != '\\')
      continue;

    json.append(value.substr(start, index - start));
    if (character == '"' || character == '\\') {
      json.push_back('\\');
      json.push_back(static_cast<char>(character));
    } else {
      json.append("\\u00");
      json.push_back(hex[character >> 4]);
      json.push_back(hex[character & 0xf]);
    }
    start = index + 1;
  }
  json.append(value.substr(start));
  json.push_back('"');
  return true;
}

void appendJSONInteger(std::string& json, int64_t value) {
  char buffer[21];
  const auto [end, error] = std::to_chars(buffer, buffer + sizeof(buffer), value);
  if (error != std::errc())
    throw std::runtime_error("Failed to encode SQLite integer as JSON");
  json.append(buffer, end);
}

bool appendJSONNumber(std::string& json, double value) {
  if (!std::isfinite(value))
    return false;

  const bool negativeZero = value == 0 && std::signbit(value);
  // REAL columns often hold whole numbers, which print several times faster as integers.
  if (!negativeZero && std::fabs(value) < 0x1p53 && std::trunc(value) == value) {
    appendJSONInteger(json, static_cast<int64_t>(value));
    return true;
  }

  char buffer[32];
#if defined(__APPLE__)
  const auto toChars = appleDoubleToChars();
  if (toChars == nullptr) {
    // SQLite's formatter drops the sign of -0.
    if (negativeZero) {
      json.append("-0");
    } else {
      sqlite3_snprintf(sizeof(buffer), buffer, "%!.17g", value);
      json.append(buffer);
    }
    return true;
  }
  const auto [end, error] = toChars(buffer, buffer + sizeof(buffer), value);
#else
  const auto [end, error] = std::to_chars(buffer, buffer + sizeof(buffer), value);
#endif
  if (error != std::errc())
    throw std::runtime_error("Failed to encode SQLite number as JSON");
  json.append(buffer, end);
  return true;
}

#if defined(__APPLE__)
namespace {
  // Apple's libc++ has shipped floating-point to_chars since iOS 16.3, but hides it from code that targets iOS 16.0.
  // Look it up at runtime so newer systems skip SQLite's formatter, which takes about twice as long.
  DoubleToChars appleDoubleToChars() {
    static const auto function = reinterpret_cast<DoubleToChars>(dlsym(RTLD_DEFAULT, "_ZNSt3__18to_charsEPcS0_d"));
    return function;
  }
} // namespace
#endif

} // namespace margelo::nitro::rnnitrosqlite
