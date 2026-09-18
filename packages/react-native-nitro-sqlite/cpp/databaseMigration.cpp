#include "databaseMigration.hpp"
#include "logs.hpp"
#include <array>
#include <system_error>

namespace margelo::nitro::rnnitrosqlite {

namespace fs = std::filesystem;

namespace {

  constexpr std::size_t kDatabaseFileCount = 4;
  using DatabaseFiles = std::array<std::string, kDatabaseFileCount>;

  DatabaseFiles getDatabaseFiles(const std::string& dbName);
  bool copyDatabaseFiles(const DatabaseFiles& files, const fs::path& fromDirectory, const fs::path& toDirectory);
  void removeAuxiliaryDatabaseFiles(const DatabaseFiles& files, const fs::path& directory);

} // namespace

fs::path migrateDatabase(const std::string& dbName, const fs::path& fromDirectory, const fs::path& toDirectory) {
  const auto files = getDatabaseFiles(dbName);
  std::error_code ec;
  const bool sourceExists = fs::exists(fromDirectory / dbName, ec);

  if (ec) {
    LOGW("Failed to inspect database %s in its old location: %s", dbName.c_str(), ec.message().c_str());
    return fromDirectory;
  }

  if (!sourceExists) {
    // A completed migration may have been interrupted after deleting the database but before
    // deleting its journals. The destination is already authoritative in that state.
    removeAuxiliaryDatabaseFiles(files, fromDirectory);
    return toDirectory;
  }

  // A database in the old directory is the live copy. Clear every database generation file at
  // the destination before copying so SQLite never pairs the source with a stale journal.
  if (!removeDatabaseFiles(dbName, toDirectory)) {
    return fromDirectory;
  }

  fs::create_directories(toDirectory, ec);
  if (ec) {
    LOGW("Failed to create database migration directory %s: %s", toDirectory.string().c_str(), ec.message().c_str());
    return fromDirectory;
  }

  if (!copyDatabaseFiles(files, fromDirectory, toDirectory)) {
    return fromDirectory;
  }

  // Delete the database first. If this fails, every source journal must remain beside it so the
  // caller can safely keep using the old location. Leftover journals after a successful database
  // deletion are harmless and are removed on the next migration attempt.
  if (!fs::remove(fromDirectory / dbName, ec) || ec) {
    LOGW("Failed to remove migrated database %s from its old location: %s", dbName.c_str(), ec.message().c_str());
    return fromDirectory;
  }

  removeAuxiliaryDatabaseFiles(files, fromDirectory);
  return toDirectory;
}

bool removeDatabaseFiles(const std::string& dbName, const fs::path& directory) {
  const auto files = getDatabaseFiles(dbName);

  for (const auto& file : files) {
    std::error_code ec;
    fs::remove(directory / file, ec);
    if (ec) {
      LOGW("Failed to remove database file %s: %s", file.c_str(), ec.message().c_str());
      return false;
    }
  }

  return true;
}

namespace {

  DatabaseFiles getDatabaseFiles(const std::string& dbName) {
    return {dbName, dbName + "-journal", dbName + "-wal", dbName + "-shm"};
  }

  bool copyDatabaseFiles(const DatabaseFiles& files, const fs::path& fromDirectory, const fs::path& toDirectory) {
    for (const auto& file : files) {
      std::error_code ec;
      const bool sourceExists = fs::exists(fromDirectory / file, ec);

      if (ec) {
        LOGW("Failed to inspect database file %s: %s", file.c_str(), ec.message().c_str());
        return false;
      }

      if (!sourceExists) {
        continue;
      }

      if (!fs::copy_file(fromDirectory / file, toDirectory / file, ec) || ec) {
        LOGW("Failed to migrate database file %s: %s", file.c_str(), ec.message().c_str());
        return false;
      }
    }

    return true;
  }

  void removeAuxiliaryDatabaseFiles(const DatabaseFiles& files, const fs::path& directory) {
    for (std::size_t index = 1; index < files.size(); index++) {
      const auto& file = files[index];
      std::error_code ec;
      fs::remove(directory / file, ec);
      if (ec) {
        LOGW("Failed to remove database file %s: %s", file.c_str(), ec.message().c_str());
      }
    }
  }

} // namespace

} // namespace margelo::nitro::rnnitrosqlite
