#include "databaseMigration.hpp"
#include <array>
#include <cerrno>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <iterator>
#include <sqlite3.h>
#include <stdexcept>
#include <string>
#include <sys/wait.h>
#include <unistd.h>

namespace fs = std::filesystem;
using namespace margelo::nitro::rnnitrosqlite;

namespace {

constexpr std::array<const char*, 4> kDatabaseSuffixes = {"", "-journal", "-wal", "-shm"};

void expect(bool condition, const std::string& message);

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

class SQLiteDatabase {
public:
  explicit SQLiteDatabase(const fs::path& path) {
    const int result = sqlite3_open(path.string().c_str(), &database);
    if (result == SQLITE_OK) {
      return;
    }

    const std::string message = database == nullptr ? sqlite3_errstr(result) : sqlite3_errmsg(database);
    sqlite3_close_v2(database);
    database = nullptr;
    throw std::runtime_error("failed to open SQLite database: " + message);
  }

  ~SQLiteDatabase() {
    sqlite3_close_v2(database);
  }

  SQLiteDatabase(const SQLiteDatabase&) = delete;
  SQLiteDatabase& operator=(const SQLiteDatabase&) = delete;

  void execute(const std::string& sql) {
    char* errorMessage = nullptr;
    const int result = sqlite3_exec(database, sql.c_str(), nullptr, nullptr, &errorMessage);
    if (result == SQLITE_OK) {
      return;
    }

    const std::string message = errorMessage == nullptr ? sqlite3_errmsg(database) : errorMessage;
    sqlite3_free(errorMessage);
    throw std::runtime_error("SQLite statement failed: " + message);
  }

  std::string queryText(const std::string& sql) {
    sqlite3_stmt* statement = nullptr;
    int result = sqlite3_prepare_v2(database, sql.c_str(), -1, &statement, nullptr);
    if (result != SQLITE_OK) {
      throw std::runtime_error("failed to prepare SQLite query: " + std::string(sqlite3_errmsg(database)));
    }

    result = sqlite3_step(statement);
    if (result != SQLITE_ROW) {
      const std::string message = sqlite3_errmsg(database);
      sqlite3_finalize(statement);
      throw std::runtime_error("SQLite query returned no row: " + message);
    }

    const auto* value = reinterpret_cast<const char*>(sqlite3_column_text(statement, 0));
    const std::string text = value == nullptr ? "" : value;
    result = sqlite3_finalize(statement);
    if (result != SQLITE_OK) {
      throw std::runtime_error("failed to finalize SQLite query: " + std::string(sqlite3_errmsg(database)));
    }

    return text;
  }

  void flushCache() {
    const int result = sqlite3_db_cacheflush(database);
    if (result != SQLITE_OK) {
      throw std::runtime_error("failed to flush SQLite cache: " + std::string(sqlite3_errmsg(database)));
    }
  }

  void abandonWithoutClosing() {
    database = nullptr;
  }

private:
  sqlite3* database = nullptr;
};

void migratesDatabaseAndEveryJournalType();
void removesStaleDestinationJournalsMissingFromSource();
void fallsBackWithoutChangingSourceFilesWhenDestinationCleanupFails();
void removesOrphanedSourceJournalsAfterAnInterruptedMigration();
void removesEveryDatabaseGenerationFile();
void recoversCommittedWalAfterMigration();
void rollsBackHotJournalAfterMigration();
void runWithoutCleanShutdown(const std::function<void()>& action);
void writeFile(const fs::path& path, const std::string& contents);
std::string readFile(const fs::path& path);

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
      {"recovers committed WAL content after migration", recoversCommittedWalAfterMigration},
      {"rolls back a hot journal after migration", rollsBackHotJournalAfterMigration},
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

void recoversCommittedWalAfterMigration() {
  TemporaryDirectory temporaryDirectory;
  const auto source = temporaryDirectory.path / "Documents";
  const auto destination = temporaryDirectory.path / "Application Support";
  const auto control = temporaryDirectory.path / "without-wal.sqlite";
  const std::string dbName = "wal.sqlite";
  const auto sourceDatabase = source / dbName;

  fs::create_directories(source);
  {
    SQLiteDatabase database(sourceDatabase);
    database.execute("PRAGMA journal_mode=WAL");
    database.execute("CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
  }

  runWithoutCleanShutdown([&]() {
    SQLiteDatabase database(sourceDatabase);
    database.execute("PRAGMA wal_autocheckpoint=0");
    database.execute("INSERT INTO records (value) VALUES ('committed in WAL')");
    database.abandonWithoutClosing();
  });

  expect(fs::exists(sourceDatabase.string() + "-wal"), "the crashed writer should leave a WAL file");
  fs::copy_file(sourceDatabase, control);
  {
    SQLiteDatabase database(control);
    expect(database.queryText("SELECT COUNT(*) FROM records") == "0", "the committed row should exist only in the WAL fixture");
  }

  const auto resolvedDirectory = migrateDatabase(dbName, source, destination);

  expect(resolvedDirectory == destination, "the WAL database should migrate to the destination");
  SQLiteDatabase migratedDatabase(destination / dbName);
  expect(migratedDatabase.queryText("SELECT value FROM records WHERE id = 1") == "committed in WAL",
         "opening the migrated database should recover committed WAL content");
  expect(migratedDatabase.queryText("PRAGMA integrity_check") == "ok", "the migrated WAL database should pass integrity_check");
}

void rollsBackHotJournalAfterMigration() {
  TemporaryDirectory temporaryDirectory;
  const auto source = temporaryDirectory.path / "Documents";
  const auto destination = temporaryDirectory.path / "Application Support";
  const auto control = temporaryDirectory.path / "without-journal.sqlite";
  const std::string dbName = "rollback.sqlite";
  const auto sourceDatabase = source / dbName;

  fs::create_directories(source);
  {
    SQLiteDatabase database(sourceDatabase);
    database.execute("PRAGMA journal_mode=DELETE");
    database.execute("PRAGMA synchronous=FULL");
    database.execute("CREATE TABLE records (id INTEGER PRIMARY KEY, value TEXT NOT NULL)");
    database.execute("INSERT INTO records (value) VALUES ('committed value')");
  }

  runWithoutCleanShutdown([&]() {
    SQLiteDatabase database(sourceDatabase);
    database.execute("PRAGMA journal_mode=DELETE");
    database.execute("PRAGMA synchronous=FULL");
    database.execute("BEGIN IMMEDIATE");
    database.execute("UPDATE records SET value = 'uncommitted value' WHERE id = 1");
    database.flushCache();
    database.abandonWithoutClosing();
  });

  expect(fs::exists(sourceDatabase.string() + "-journal"), "the crashed writer should leave a rollback journal");
  fs::copy_file(sourceDatabase, control);
  {
    SQLiteDatabase database(control);
    expect(database.queryText("SELECT value FROM records WHERE id = 1") == "uncommitted value",
           "the database fixture should require its rollback journal");
  }

  const auto resolvedDirectory = migrateDatabase(dbName, source, destination);

  expect(resolvedDirectory == destination, "the rollback-journal database should migrate to the destination");
  SQLiteDatabase migratedDatabase(destination / dbName);
  expect(migratedDatabase.queryText("SELECT value FROM records WHERE id = 1") == "committed value",
         "opening the migrated database should roll back the interrupted transaction");
  expect(migratedDatabase.queryText("PRAGMA integrity_check") == "ok",
         "the migrated rollback-journal database should pass integrity_check");
}

void runWithoutCleanShutdown(const std::function<void()>& action) {
  const pid_t child = fork();
  if (child == -1) {
    throw std::runtime_error("failed to fork crash-test child process");
  }

  if (child == 0) {
    try {
      action();
      _exit(EXIT_SUCCESS);
    } catch (const std::exception& error) {
      std::fprintf(stderr, "crash-test child failed: %s\n", error.what());
      _exit(EXIT_FAILURE);
    }
  }

  int status = 0;
  pid_t waitResult;
  do {
    waitResult = waitpid(child, &status, 0);
  } while (waitResult == -1 && errno == EINTR);

  expect(waitResult == child, "failed to wait for crash-test child process");
  expect(WIFEXITED(status) && WEXITSTATUS(status) == EXIT_SUCCESS, "crash-test child process failed");
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
