#pragma once

#include <cstdint>
#include <string>
#include <string_view>

namespace margelo::nitro::rnnitrosqlite {

/** Append a quoted JSON string, preserving UTF-8 and escaping control characters. Return false for malformed UTF-8. */
bool appendJSONString(std::string& json, std::string_view value);

/** Append an SQLite integer as a JSON number. JavaScript still receives a number, not a bigint. */
void appendJSONInteger(std::string& json, int64_t value);

/** Append a finite number with exact double round-trip precision, writing whole numbers below 2^53 as integers.
 * Return false without appending for NaN or infinity. */
bool appendJSONNumber(std::string& json, double value);

} // namespace margelo::nitro::rnnitrosqlite
