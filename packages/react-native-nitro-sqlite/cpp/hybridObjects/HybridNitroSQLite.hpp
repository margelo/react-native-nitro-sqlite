#pragma once

#include "../NitroSQLiteTypes.hpp"
#include "HybridNitroSQLiteQueryResultSpec.hpp"
#include "HybridNitroSQLiteSpec.hpp"

namespace margelo::nitro::rnnitrosqlite {

/** Native database operations exposed to JavaScript through the Nitro hybrid object. */
class HybridNitroSQLite : public HybridNitroSQLiteSpec {
public:
  HybridNitroSQLite() : HybridObject(TAG) {}

public:
  static std::string docPath;
  // Directory databases were stored in by previous app versions, when the platform layer has
  // relocated docPath (e.g. iOS with RNNitroSQLite_DatabaseLocation set to "ApplicationSupport").
  // When non-empty, databases found there are resolved as they are opened, attached, or dropped.
  static std::string migrationDocPath;

public:
  /** Open or create a database on the calling thread.
   * @param dbName Database file name.
   * @param location Optional directory relative to the platform database root.
   */
  void open(const std::string& dbName, const std::optional<std::string>& location) override;

  /** Close the named native database handle. */
  void close(const std::string& dbName) override;

  /** Remove a database file and close its native handle if open.
   * @param location Optional directory relative to the platform database root.
   */
  void drop(const std::string& dbName, const std::optional<std::string>& location) override;

  /** Attach a database file to an open database.
   * @param mainDbName Name of the open main database.
   * @param dbNameToAttach File name of the database to attach.
   * @param alias SQL schema name for the attached database.
   * @param location Optional directory relative to the platform database root.
   */
  void attach(const std::string& mainDbName, const std::string& dbNameToAttach, const std::string& alias,
              const std::optional<std::string>& location) override;

  /** Detach the database identified by @p alias from @p mainDbName. */
  void detach(const std::string& mainDbName, const std::string& alias) override;

  /** Execute one SQL statement on the calling thread.
   * @param dbName Name of an open database.
   * @param query SQL statement with optional positional placeholders.
   * @param params Optional values bound to the placeholders.
   * @return Native rows, affected row count, insert ID, and metadata.
   */
  std::shared_ptr<HybridNitroSQLiteQueryResultSpec> execute(const std::string& dbName, const std::string& query,
                                                            const std::optional<SQLiteQueryParams>& params) override;

  /** Execute one SQL statement on a background thread.
   * @return A promise of the native query result.
   */
  std::shared_ptr<Promise<std::shared_ptr<HybridNitroSQLiteQueryResultSpec>>>
  executeAsync(const std::string& dbName, const std::string& query, const std::optional<SQLiteQueryParams>& params) override;

  /** Run a nonempty batch in one exclusive transaction on the calling thread.
   * A failed command rolls back the batch.
   * @return Total affected row count.
   */
  BatchQueryResult executeBatch(const std::string& dbName, const std::vector<BatchQueryCommand>& commands) override;
  /** Run a nonempty batch in one exclusive transaction on a background thread.
   * @return A promise of the total affected row count.
   */
  std::shared_ptr<Promise<BatchQueryResult>> executeBatchAsync(const std::string& dbName,
                                                               const std::vector<BatchQueryCommand>& commands) override;

  /** Import a SQL file in one exclusive transaction on the calling thread.
   * Each nonempty line is interpreted as one statement.
   * @param location Path to the SQL file.
   * @return Number of executed commands and affected rows.
   */
  FileLoadResult loadFile(const std::string& dbName, const std::string& location) override;
  /** Import a SQL file on a background thread.
   * @param location Path to the SQL file.
   * @return A promise of the command and affected row counts.
   */
  std::shared_ptr<Promise<FileLoadResult>> loadFileAsync(const std::string& dbName, const std::string& location) override;
};

inline std::string HybridNitroSQLite::docPath = "";
inline std::string HybridNitroSQLite::migrationDocPath = "";

} // namespace margelo::nitro::rnnitrosqlite
