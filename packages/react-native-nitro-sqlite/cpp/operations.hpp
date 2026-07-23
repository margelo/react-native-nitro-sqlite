#pragma once

#include "hybridObjects/HybridNitroSQLiteQueryResult.hpp"
#include "types.hpp"

namespace margelo::rnnitrosqlite {

class SQLitePreparedStatement {
public:
  ~SQLitePreparedStatement();

  std::shared_ptr<HybridNitroSQLiteQueryResult> execute(const std::optional<SQLiteQueryParams>& params);
  void finalize();
  bool isFinalized() const;
  size_t getExternalMemorySize() const noexcept;

private:
  struct State;

  explicit SQLitePreparedStatement(std::shared_ptr<State> state);

  std::shared_ptr<State> _state;

  friend std::shared_ptr<SQLitePreparedStatement> sqlitePrepare(const std::string& dbName, const std::string& query);
};

void sqliteOpenDb(const std::string& dbName, const std::string& docPath);

void sqliteCloseDb(const std::string& dbName);

void sqliteRemoveDb(const std::string& dbName, const std::string& docPath);

void sqliteAttachDb(const std::string& mainDBName, const std::string& docPath, const std::string& databaseToAttach,
                    const std::string& alias);

void sqliteDetachDb(const std::string& mainDBName, const std::string& alias);

std::shared_ptr<HybridNitroSQLiteQueryResult> sqliteExecute(const std::string& dbName, const std::string& query,
                                                            const std::optional<SQLiteQueryParams>& params);

SQLiteOperationResult sqliteExecuteCommand(const std::string& dbName, const std::string& query,
                                           const std::optional<SQLiteQueryParams>& params = std::nullopt);

std::shared_ptr<SQLitePreparedStatement> sqlitePrepare(const std::string& dbName, const std::string& query);

void sqliteCloseAll();

} // namespace margelo::rnnitrosqlite
