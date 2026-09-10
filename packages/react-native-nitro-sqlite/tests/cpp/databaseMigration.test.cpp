#include "databaseMigration.hpp"
#include <array>
#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>

namespace fs = std::filesystem;
using namespace margelo::nitro::rnnitrosqlite;

namespace {

constexpr std::array<const char*, 4> kDatabaseSuffixes = {"", "-journal", "-wal", "-shm"};

class TemporaryDirectory {
public:
  TemporaryDirectory() {
    const auto uniqueId = std::chrono::steady_clock::now().time_since_epoch().count();
    path = fs::temp_directory_path() / ("nitro-sqlite-migration-" + std::to_string(uniqueId));
    fs::create_directories(path);
  }

  ~TemporaryDirectory() {
    std::error_code ec;
    fs::remove_all(path, ec);
  }

  fs::path path;
};

void migratesDatabaseAndEveryJournalType();
void removesStaleDestinationJournalsMissingFromSource();
void fallsBackWithoutChangingSourceFilesWhenDestinationCleanupFails();
void removesOrphanedSourceJournalsAfterAnInterruptedMigration();
void removesEveryDatabaseGenerationFile();
void writeFile(const fs::path& path, const std::string& contents);
std::string readFile(const fs::path& path);
void expect(bool condition, const std::string& message);

} // namespace

int main() {
  struct TestCase {
    const char* name;
    void (*run)();
  };

  const TestCase tests[] = {
      {"migrates database and every journal type", migratesDatabaseAndEveryJournalType},
      {"removes stale destination journals missing from source", removesStaleDestinationJournalsMissingFromSource},
      {"falls back without changing source files when destination cleanup fails",
       fallsBackWithoutChangingSourceFilesWhenDestinationCleanupFails},
      {"removes orphaned source journals after an interrupted migration", removesOrphanedSourceJournalsAfterAnInterruptedMigration},
      {"removes every database generation file", removesEveryDatabaseGenerationFile},
  };

  int failures = 0;
  for (const auto& test : tests) {
    try {
      test.run();
      std::cout << "[PASS] " << test.name << '\n';
    } catch (const std::exception& error) {
      failures++;
      std::cerr << "[FAIL] " << test.name << ": " << error.what() << '\n';
    }
  }

  return failures == 0 ? EXIT_SUCCESS : EXIT_FAILURE;
}

namespace {

void migratesDatabaseAndEveryJournalType() {
  TemporaryDirectory temporaryDirectory;
  const auto source = temporaryDirectory.path / "Documents";
  const auto destination = temporaryDirectory.path / "Application Support";
  const std::string dbName = "database.sqlite";

  for (const auto* suffix : kDatabaseSuffixes) {
    const std::string fileName = dbName + suffix;
    writeFile(source / fileName, "source:" + fileName);
    writeFile(destination / fileName, "stale:" + fileName);
  }

  const auto resolvedDirectory = migrateDatabase(dbName, source, destination);

  expect(resolvedDirectory == destination, "the destination should be selected after a successful migration");
  for (const auto* suffix : kDatabaseSuffixes) {
    const std::string fileName = dbName + suffix;
    expect(!fs::exists(source / fileName), "the source file should be removed: " + fileName);
    expect(readFile(destination / fileName) == "source:" + fileName, "the source should replace the stale file: " + fileName);
  }
}

void removesStaleDestinationJournalsMissingFromSource() {
  TemporaryDirectory temporaryDirectory;
  const auto source = temporaryDirectory.path / "Documents";
  const auto destination = temporaryDirectory.path / "Application Support";
  const std::string dbName = "database.sqlite";

  writeFile(source / dbName, "source database");
  writeFile(destination / dbName, "stale database");
  for (std::size_t index = 1; index < kDatabaseSuffixes.size(); index++) {
    writeFile(destination / (dbName + kDatabaseSuffixes[index]), "stale journal");
  }

  const auto resolvedDirectory = migrateDatabase(dbName, source, destination);

  expect(resolvedDirectory == destination, "the destination should be selected after migration");
  expect(readFile(destination / dbName) == "source database", "the source database should replace the stale database");
  for (std::size_t index = 1; index < kDatabaseSuffixes.size(); index++) {
    expect(!fs::exists(destination / (dbName + kDatabaseSuffixes[index])), "stale destination journals should be removed");
  }
}

void fallsBackWithoutChangingSourceFilesWhenDestinationCleanupFails() {
  TemporaryDirectory temporaryDirectory;
  const auto source = temporaryDirectory.path / "Documents";
  const auto destination = temporaryDirectory.path / "Application Support";
  const std::string dbName = "database.sqlite";

  for (const auto* suffix : kDatabaseSuffixes) {
    const std::string fileName = dbName + suffix;
    writeFile(source / fileName, "source:" + fileName);
  }
  writeFile(destination / dbName / "child", "prevents directory removal");

  const auto resolvedDirectory = migrateDatabase(dbName, source, destination);

  expect(resolvedDirectory == source, "the source should remain selected when destination cleanup fails");
  for (const auto* suffix : kDatabaseSuffixes) {
    const std::string fileName = dbName + suffix;
    expect(readFile(source / fileName) == "source:" + fileName, "fallback should preserve the source file: " + fileName);
  }
}

void removesOrphanedSourceJournalsAfterAnInterruptedMigration() {
  TemporaryDirectory temporaryDirectory;
  const auto source = temporaryDirectory.path / "Documents";
  const auto destination = temporaryDirectory.path / "Application Support";
  const std::string dbName = "database.sqlite";

  writeFile(destination / dbName, "migrated database");
  for (std::size_t index = 1; index < kDatabaseSuffixes.size(); index++) {
    writeFile(source / (dbName + kDatabaseSuffixes[index]), "orphaned journal");
  }

  const auto resolvedDirectory = migrateDatabase(dbName, source, destination);

  expect(resolvedDirectory == destination, "the completed migration should keep using the destination");
  expect(readFile(destination / dbName) == "migrated database", "the migrated database should remain unchanged");
  for (std::size_t index = 1; index < kDatabaseSuffixes.size(); index++) {
    expect(!fs::exists(source / (dbName + kDatabaseSuffixes[index])), "orphaned source journals should be removed");
  }
}

void removesEveryDatabaseGenerationFile() {
  TemporaryDirectory temporaryDirectory;
  const auto directory = temporaryDirectory.path / "Database";
  const std::string dbName = "database.sqlite";

  for (const auto* suffix : kDatabaseSuffixes) {
    writeFile(directory / (dbName + suffix), "database generation file");
  }

  expect(removeDatabaseFiles(dbName, directory), "database file cleanup should succeed");
  for (const auto* suffix : kDatabaseSuffixes) {
    expect(!fs::exists(directory / (dbName + suffix)), "database generation files should be removed");
  }
}

void writeFile(const fs::path& path, const std::string& contents) {
  fs::create_directories(path.parent_path());
  std::ofstream file(path, std::ios::binary);
  file << contents;
  expect(file.good(), "failed to write test file: " + path.string());
}

std::string readFile(const fs::path& path) {
  std::ifstream file(path, std::ios::binary);
  return {std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>()};
}

void expect(bool condition, const std::string& message) {
  if (!condition) {
    throw std::runtime_error(message);
  }
}

} // namespace
