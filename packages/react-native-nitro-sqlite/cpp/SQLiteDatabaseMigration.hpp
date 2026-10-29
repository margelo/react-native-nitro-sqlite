#pragma once

#include <filesystem>
#include <string>

namespace margelo::nitro::rnnitrosqlite {

std::filesystem::path migrateDatabase(const std::string& dbName, const std::filesystem::path& fromDirectory,
                                      const std::filesystem::path& toDirectory);

bool removeDatabaseFiles(const std::string& dbName, const std::filesystem::path& directory);

} // namespace margelo::nitro::rnnitrosqlite
