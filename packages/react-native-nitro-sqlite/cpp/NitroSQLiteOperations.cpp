#include "NitroSQLiteOperations.hpp"
#include "NitroSQLiteException.hpp"
#include "NitroSQLiteStatementGroup.hpp"
#include "NitroSQLiteUtils.hpp"
#include "sqlite/sqlite3.h"
#include <NitroModules/ArrayBuffer.hpp>
#include <cmath>
#include <ctime>
#include <exception>
#include <iostream>
#include <limits>
#include <memory>
#include <mutex>
#include <optional>
#include <sstream>
#include <unistd.h>

#ifdef NITRO_SQLITE_VEC
// Angle-bracket so it resolves via -I (CocoaPods intercepts quoted includes).
#include <NitroSQLiteVecRegisterVectorExtensions.hpp>
#endif

using namespace facebook;

namespace margelo::nitro::rnnitrosqlite {

static constexpr double kInt64MinAsDouble = static_cast<double>(std::numeric_limits<int64_t>::min());
static constexpr double kInt64UpperBoundAsDouble = -kInt64MinAsDouble;

void sqliteOpenDb(DatabaseConnections& connections, const std::string& dbName, const std::string& docPath, bool readOnly,
                  const std::optional<std::string>& encryptionKey) {
#ifdef NITRO_SQLITE_VEC
  // Register before opening so the connection exposes vec0 + vec_*.
  margelo::rnnitrosqlitevec::registerVectorExtensions();
#endif
  const std::string dbPath = readOnly ? docPath + "/" + dbName : get_db_path(dbName, docPath);
  connections.open(dbName, dbPath, readOnly, encryptionKey);
}

std::string sqliteOpenConnection(DatabaseConnections& connections, const std::string& dbName, const std::string& docPath, bool readOnly,
                                 const std::optional<std::string>& encryptionKey) {
  if (sqlite3_threadsafe() == 0) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::DatabaseCannotBeOpened,
                               "Independent connections require a thread-safe SQLite build");
  }
#ifdef NITRO_SQLITE_VEC
  margelo::rnnitrosqlitevec::registerVectorExtensions();
#endif
  const std::string dbPath = readOnly ? docPath + "/" + dbName : get_db_path(dbName, docPath);
  return connections.openIndependent(dbPath, readOnly, encryptionKey);
}

void sqliteAttachDb(const SQLiteConnectionPtr& connection, const std::string& docPath, const std::string& databaseToAttach,
                    const std::string& alias) {
  std::string dbPath = get_db_path(databaseToAttach, docPath);
  std::string statement = "ATTACH DATABASE '" + dbPath + "' AS " + alias;

  try {
    sqliteExecuteCommand(connection, statement);
  } catch (NitroSQLiteException& e) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::UnableToAttachToDatabase,
                               connection->name + " was unable to attach another database: " + std::string(e.what()));
  }
}

void sqliteDetachDb(const SQLiteConnectionPtr& connection, const std::string& alias) {
  std::string statement = "DETACH DATABASE " + alias;

  try {
    sqliteExecuteCommand(connection, statement);
  } catch (NitroSQLiteException& e) {
    throw NitroSQLiteException(NitroSQLiteExceptionType::UnableToAttachToDatabase,
                               connection->name + " was unable to detach database: " + std::string(e.what()));
  }
}

void sqliteRemoveDb(DatabaseConnections& connections, const std::string& dbName, const std::string& docPath,
                    const std::optional<std::string>& connectionId, const std::optional<std::string>& otherDocPath) {
  std::optional<std::filesystem::path> otherPath;
  if (otherDocPath) {
    otherPath = std::filesystem::path(*otherDocPath) / dbName;
  }
  connections.drop(dbName, std::filesystem::path(docPath) / dbName, connectionId, otherPath);
}

void bindStatement(sqlite3_stmt* statement, const SQLiteQueryParams& values) {
  for (size_t valueIndex = 0; valueIndex < values.size(); valueIndex++) {
    int sqliteIndex = valueIndex + 1;
    const auto& optionalValue = values.at(valueIndex);
    int bindStatus = SQLITE_OK;

    if (!optionalValue || std::holds_alternative<NullType>(*optionalValue)) {
      bindStatus = sqlite3_bind_null(statement, sqliteIndex);
    } else if (std::holds_alternative<bool>(*optionalValue)) {
      bindStatus = sqlite3_bind_int(statement, sqliteIndex, std::get<bool>(*optionalValue));
    } else if (std::holds_alternative<double>(*optionalValue)) {
      // Bind whole numbers as INTEGER so vec0 rowid/pk/partition (which reject REAL) work; SQLite still coerces to REAL for REAL columns.
      double doubleValue = std::get<double>(*optionalValue);
      if (std::trunc(doubleValue) == doubleValue && doubleValue >= kInt64MinAsDouble && doubleValue < kInt64UpperBoundAsDouble) {
        bindStatus = sqlite3_bind_int64(statement, sqliteIndex, static_cast<sqlite3_int64>(doubleValue));
      } else {
        bindStatus = sqlite3_bind_double(statement, sqliteIndex, doubleValue);
      }
    } else if (std::holds_alternative<std::string>(*optionalValue)) {
      const auto& stringValue = std::get<std::string>(*optionalValue);
      bindStatus = sqlite3_bind_text(statement, sqliteIndex, stringValue.c_str(), stringValue.length(), SQLITE_TRANSIENT);
    } else if (std::holds_alternative<std::shared_ptr<ArrayBuffer>>(*optionalValue)) {
      const auto& arrayBufferValue = std::get<std::shared_ptr<ArrayBuffer>>(*optionalValue);
      bindStatus = sqlite3_bind_blob(statement, sqliteIndex, arrayBufferValue->data(), arrayBufferValue->size(), SQLITE_TRANSIENT);
    }

    if (bindStatus != SQLITE_OK) {
      throw NitroSQLiteException::SqlExecution("Failed to bind parameter " + std::to_string(sqliteIndex) + " (SQLite error " +
                                               std::to_string(bindStatus) + "): " + sqlite3_errstr(bindStatus));
    }
  }
}

namespace {

  struct SQLiteStatementFinalizer {
    void operator()(sqlite3_stmt* statement) const noexcept {
      if (statement != nullptr) {
        sqlite3_finalize(statement);
      }
    }
  };

  using SQLiteStatement = std::unique_ptr<sqlite3_stmt, SQLiteStatementFinalizer>;

  SQLiteStatement prepareStatement(sqlite3* db, const std::string& query, const std::optional<SQLiteQueryParams>& params) {
    sqlite3_stmt* rawStatement = nullptr;
    int statementStatus = sqlite3_prepare_v2(db, query.c_str(), -1, &rawStatement, nullptr);
    SQLiteStatement statement(rawStatement);

    if (statementStatus != SQLITE_OK) {
      throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(db));
    }

    // sqlite3_prepare_v2 reports SQLITE_OK with a null statement when the query holds no SQL,
    // such as an empty string or nothing but comments.
    if (!statement) {
      throw NitroSQLiteException::SqlExecution("Query does not contain any SQL statement");
    }

    if (params) {
      bindStatement(statement.get(), *params);
    }

    return statement;
  }

  // Borrows the connection's cached statement for a query, or prepares one, and returns it
  // reset to the cache when the scope ends. Requires the connection's mutex.
  class CachedStatement final {
  public:
    CachedStatement(SQLiteConnection& connection, const std::string& query)
        : _connection(connection), _query(query), _cacheable(SQLiteStatementCache::isCacheable(query)) {
      if (_cacheable) {
        _statement = connection.statementCache.take(query);
      }
      if (_statement == nullptr) {
        _statement = prepareStatement(connection.database, query, std::nullopt).release();
      }
    }

    ~CachedStatement() {
      if (!_cacheable) {
        sqlite3_finalize(_statement);
        return;
      }
      sqlite3_reset(_statement);
      sqlite3_clear_bindings(_statement);
      _connection.statementCache.put(_query, _statement);
    }

    CachedStatement(const CachedStatement&) = delete;
    CachedStatement& operator=(const CachedStatement&) = delete;

    sqlite3_stmt* get() const {
      return _statement;
    }

  private:
    SQLiteConnection& _connection;
    const std::string& _query;
    const bool _cacheable;
    sqlite3_stmt* _statement = nullptr;
  };

  template <typename OnRow>
  void consumeStatement(sqlite3* db, sqlite3_stmt* statement, OnRow&& onRow) {
    while (true) {
      int result = sqlite3_step(statement);

      if (result == SQLITE_ROW) {
        onRow(statement);
        continue;
      }

      if (result == SQLITE_DONE) {
        return;
      }

      throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(db));
    }
  }

  // Rows per batch handed to a row batch handler. Each batch costs a hand-off to the JS thread,
  // and a smaller final batch shortens the conversion left after the statement completes.
  constexpr size_t kRowBatchSize = 256;

  NitroSQLiteQueryResult executeStatement(sqlite3* db, sqlite3_stmt* statement, const SQLiteRowBatchHandler& onRows = nullptr) {
    int columnCount = 0;
    std::vector<std::string> columnNames;
    std::vector<SQLiteQueryResultRow> rows;
    bool columnsCaptured = false;

    const auto captureColumns = [&] {
      columnCount = sqlite3_column_count(statement);
      columnNames.reserve(columnCount);
      for (int i = 0; i < columnCount; i++) {
        const char* columnName = sqlite3_column_name(statement, i);
        if (columnName == nullptr) {
          throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(db));
        }
        columnNames.emplace_back(columnName);
      }
      columnsCaptured = true;
    };

    consumeStatement(db, statement, [&](sqlite3_stmt* currentStatement) {
      if (!columnsCaptured) {
        // sqlite3_step() may reprepare a statement after a schema change.
        captureColumns();
      }

      SQLiteQueryResultRow row;
      row.reserve(columnNames.size());

      for (int i = 0; i < columnCount; i++) {
        int columnType = sqlite3_column_type(currentStatement, i);

        switch (columnType) {
          case SQLITE_INTEGER:
          case SQLITE_FLOAT:
            row.emplace_back(sqlite3_column_double(currentStatement, i));
            break;
          case SQLITE_TEXT: {
            auto columnValue = reinterpret_cast<const char*>(sqlite3_column_text(currentStatement, i));
            if (columnValue == nullptr) {
              throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(db));
            }
            int columnBytes = sqlite3_column_bytes(currentStatement, i);
            row.emplace_back(std::string(columnValue, static_cast<size_t>(columnBytes)));
            break;
          }
          case SQLITE_BLOB: {
            int blobSize = sqlite3_column_bytes(currentStatement, i);
            const void* blob = sqlite3_column_blob(currentStatement, i);
            if (blobSize > 0) {
              const auto* blobData = reinterpret_cast<const uint8_t*>(blob);
              row.emplace_back(ArrayBuffer::copy(blobData, static_cast<size_t>(blobSize)));
            } else {
              row.emplace_back(ArrayBuffer::allocate(0));
            }
            break;
          }
          case SQLITE_NULL:
          default:
            row.emplace_back(NullType::null);
            break;
        }
      }

      rows.push_back(std::move(row));
      if (onRows && rows.size() == kRowBatchSize) {
        onRows(SQLiteQueryResults(columnNames, std::move(rows)));
        rows = {};
      }
    });

    if (!columnsCaptured) {
      // A zero-row statement can also reprepare on its first step.
      captureColumns();
    }

    std::optional<SQLiteQueryTableMetadata> metadata = std::nullopt;
    for (int i = 0; i < columnCount; i++) {
      const std::string& columnName = columnNames[i];
      ColumnType columnDeclaredType = mapSQLiteTypeToColumnType(sqlite3_column_decltype(statement, i));
      auto columnMeta = NitroSQLiteQueryColumnMetadata(columnName, std::move(columnDeclaredType), i);

      if (!metadata) {
        metadata = std::make_optional<SQLiteQueryTableMetadata>();
      }
      metadata->insert({columnName, std::move(columnMeta)});
    }

    NitroSQLiteQueryResult result;
    result.rowsAffected = sqlite3_changes(db);
    result.insertId = static_cast<double>(sqlite3_last_insert_rowid(db));
    result.results = SQLiteQueryResults(std::move(columnNames), std::move(rows));
    result.metadata = std::move(metadata);
    return result;
  }

} // namespace

NitroSQLiteQueryResult sqliteExecute(const SQLiteConnectionPtr& connection, const std::string& query,
                                     const std::optional<SQLiteQueryParams>& params, const SQLiteRowBatchHandler& onRows) {
  std::lock_guard lock(connection->mutex);
  sqlite3* db = connection->database;
  if (db == nullptr) {
    throw NitroSQLiteException::DatabaseNotOpen(connection->name);
  }

  CachedStatement statement(*connection, query);
  if (params) {
    bindStatement(statement.get(), *params);
  }
  return executeStatement(db, statement.get(), onRows);
}

SQLiteOperationResult sqliteExecuteCommand(const SQLiteConnectionPtr& connection, const std::string& query,
                                           const std::optional<SQLiteQueryParams>& params) {
  std::lock_guard lock(connection->mutex);
  sqlite3* db = connection->database;
  if (db == nullptr) {
    throw NitroSQLiteException::DatabaseNotOpen(connection->name);
  }

  auto statement = prepareStatement(db, query, params);
  bool isReadOnly = sqlite3_stmt_readonly(statement.get()) != 0;

  consumeStatement(db, statement.get(), [](sqlite3_stmt*) {});

  return {.rowsAffected = isReadOnly ? 0 : sqlite3_changes(db)};
}

SQLiteOperationResult sqliteExecuteCommandGroup(const SQLiteConnectionPtr& connection, const std::string& query,
                                                const std::vector<SQLiteQueryParams>& parameterSets) {
  if (parameterSets.empty()) {
    return {.rowsAffected = 0, .commands = 0};
  }

  std::lock_guard lock(connection->mutex);
  sqlite3* db = connection->database;
  if (db == nullptr) {
    throw NitroSQLiteException::DatabaseNotOpen(connection->name);
  }

  const auto [rowsAffected, commands] = executeStatementGroup(
      db, query, parameterSets, [](sqlite3* database, const std::string& sql) { return prepareStatement(database, sql, std::nullopt); },
      [](sqlite3_stmt* statement, const SQLiteQueryParams& params) { bindStatement(statement, params); },
      [](sqlite3* database, sqlite3_stmt* statement) { consumeStatement(database, statement, [](sqlite3_stmt*) {}); },
      [](sqlite3* database) { throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(database)); });
  return {.rowsAffected = rowsAffected, .commands = commands};
}

struct SQLitePreparedStatement::State {
  State(SQLiteConnectionPtr connection, SQLiteStatement statement) : connection(std::move(connection)), statement(std::move(statement)) {}

  SQLiteConnectionPtr connection;
  SQLiteStatement statement;
  mutable std::mutex mutex;
};

SQLitePreparedStatement::SQLitePreparedStatement(std::shared_ptr<State> state) : _state(std::move(state)) {}

SQLitePreparedStatement::~SQLitePreparedStatement() {
  finalize();
}

NitroSQLiteQueryResult SQLitePreparedStatement::execute(const std::optional<SQLiteQueryParams>& params) {
  std::lock_guard lock(_state->mutex);
  std::lock_guard connectionLock(_state->connection->mutex);

  if (!_state->statement) {
    throw NitroSQLiteException("Prepared statement has been finalized");
  }

  sqlite3* database = _state->connection->database;
  if (database == nullptr) {
    throw NitroSQLiteException("Prepared statement belongs to a closed database connection");
  }

  int resetStatus = sqlite3_reset(_state->statement.get());
  if (resetStatus != SQLITE_OK) {
    throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(database));
  }

  int clearBindingsStatus = sqlite3_clear_bindings(_state->statement.get());
  if (clearBindingsStatus != SQLITE_OK) {
    throw NitroSQLiteException::SqlExecution(sqlite3_errmsg(database));
  }

  if (params) {
    bindStatement(_state->statement.get(), *params);
  }

  try {
    return executeStatement(database, _state->statement.get());
  } catch (...) {
    sqlite3_reset(_state->statement.get());
    throw;
  }
}

void SQLitePreparedStatement::finalize() {
  std::lock_guard lock(_state->mutex);
  std::lock_guard connectionLock(_state->connection->mutex);
  _state->statement.reset();
}

bool SQLitePreparedStatement::isFinalized() const {
  std::lock_guard lock(_state->mutex);
  return !_state->statement;
}

size_t SQLitePreparedStatement::getExternalMemorySize() const noexcept {
  return sizeof(*this) + sizeof(State);
}

std::shared_ptr<SQLitePreparedStatement> sqlitePrepare(const SQLiteConnectionPtr& connection, const std::string& query) {
  std::lock_guard lock(connection->mutex);
  if (connection->database == nullptr) {
    throw NitroSQLiteException::DatabaseNotOpen(connection->name);
  }

  auto statement = prepareStatement(connection->database, query, std::nullopt);
  auto state = std::make_shared<SQLitePreparedStatement::State>(connection, std::move(statement));
  return std::shared_ptr<SQLitePreparedStatement>(new SQLitePreparedStatement(std::move(state)));
}

} // namespace margelo::nitro::rnnitrosqlite
