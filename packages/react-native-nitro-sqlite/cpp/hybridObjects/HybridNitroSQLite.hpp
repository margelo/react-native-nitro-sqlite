#pragma once

#include "../NitroSQLiteDatabaseConnections.hpp"
#include "../NitroSQLiteTypes.hpp"
#include <RNNitroSQLite/HybridNitroSQLiteSpec.hpp>
#include <RNNitroSQLite/HybridPreparedStatementSpec.hpp>

namespace margelo::nitro::rnnitrosqlite {

/** Native database operations exposed to JavaScript through the Nitro hybrid object.
 * Owns its default and independent connections and closes them on destruction.
 * Queued operations and prepared statements retain their original connection and
 * fail after that connection closes. Other NitroSQLite roots remain usable.
 */
class HybridNitroSQLite : public HybridNitroSQLiteSpec {
public:
  /** Create a root that stores its databases in @p databaseDirectory.
   * @param temporaryDirectory SQLite's temporary directory. SQLite reads it once per process,
   * so the first root that passes one sets it.
   * @param legacyDatabaseDirectory Directory that previous app versions stored databases in,
   * for example Documents when iOS moves them to Application Support. Databases found there
   * are moved as they are opened, attached, or dropped.
   * @throws std::runtime_error If SQLite's temporary directory can't be configured.
   */
  HybridNitroSQLite(std::string databaseDirectory, const std::optional<std::string>& temporaryDirectory,
                    const std::optional<std::string>& legacyDatabaseDirectory);

private:
  DatabaseConnections _connections;
  std::string _databaseDirectory;
  // Empty when databases have never been stored anywhere else.
  std::string _legacyDatabaseDirectory;

public:
  // Methods
  /** Open the default connection, requiring an existing file in read-only mode. */
  void open(const std::string& dbName, const std::optional<std::string>& location, const std::optional<bool>& readOnly,
            const std::optional<std::string>& encryptionKey) override;

  /** Open a separate native handle and return an opaque ID for later calls. */
  std::string openConnection(const std::string& dbName, const std::optional<std::string>& location, const std::optional<bool>& readOnly,
                             const std::optional<std::string>& encryptionKey) override;

  /** Close the named native database handle. */
  void close(const std::string& dbName) override;

  /** Check whether a connection name or ID still identifies an open handle. */
  bool isConnectionOpen(const std::string& connectionId) override;

  /** Delete a database, closing the specified connection when it is open. */
  void drop(const std::string& dbName, const std::optional<std::string>& location, const std::optional<std::string>& connectionId) override;

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
  NitroSQLiteQueryResult execute(const std::string& dbName, const std::string& query,
                                 const std::optional<SQLiteQueryParams>& params) override;

  /** Execute one SQL statement on a background thread.
   * @return A promise of the native query result.
   */
  Promise<NitroSQLiteQueryResult> executeAsync(const std::string& dbName, const std::string& query,
                                               const std::optional<SQLiteQueryParams>& params,
                                               const std::optional<Callback<void(SQLiteQueryResults)>>& onRows) override;

  /** Prepare one SQL statement for repeated execution on an open connection. */
  std::shared_ptr<HybridPreparedStatementSpec> prepare(const std::string& dbName, const std::string& query) override;

  /** Run a nonempty batch in one exclusive transaction on the calling thread.
   * A failed command rolls back the batch.
   * @return Total affected row count.
   */
  BatchQueryResult executeBatch(const std::string& dbName, const std::vector<BatchQueryCommand>& commands) override;
  /** Run a nonempty batch in one exclusive transaction on a background thread.
   * @return A promise of the total affected row count.
   */
  Promise<BatchQueryResult> executeBatchAsync(const std::string& dbName, const std::vector<BatchQueryCommand>& commands) override;

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
  Promise<FileLoadResult> loadFileAsync(const std::string& dbName, const std::string& location) override;
};

} // namespace margelo::nitro::rnnitrosqlite
