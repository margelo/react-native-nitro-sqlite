#include "NitroSQLiteDatabaseConnections.hpp"
#include <filesystem>
#include <iostream>
#include <stdexcept>

int main() {
  if (sqlite3_threadsafe() != 0) {
    std::cerr << "[FAIL] test SQLite build is thread-safe\n";
    return 1;
  }
  margelo::nitro::rnnitrosqlite::DatabaseConnections registry;
  const auto path = std::filesystem::temp_directory_path() / "nitro-sqlite-threadsafe-gate.sqlite";
  try {
    registry.openIndependent(path, false);
  } catch (const std::exception&) {
    if (!std::filesystem::exists(path)) {
      std::cout << "[PASS] independent connections reject SQLITE_THREADSAFE=0\n";
      return 0;
    }
  }
  std::cerr << "[FAIL] independent connection opened with SQLITE_THREADSAFE=0\n";
  return 1;
}
