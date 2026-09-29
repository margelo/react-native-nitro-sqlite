import type { HybridObject } from 'react-native-nitro-modules'
import type {
  BatchQueryCommand,
  BatchQueryResult,
  FileLoadResult,
  SQLiteQueryParams,
} from '../types'
import type { NitroSQLiteQueryResult } from './NitroSQLiteQueryResult.nitro'
import type { NitroSQLitePreparedStatement } from './NitroSQLitePreparedStatement.nitro'

/** Native database operations exposed through `NitroSQLite.native`.
 * These calls bypass the managed connection queue. Coordinate them with any
 * transaction or pending operation on the same database yourself.
 */
export interface NitroSQLite
  extends HybridObject<{
    ios: 'c++'
    android: 'c++'
  }> {
  /** Open a name-based default connection, creating the database unless `readOnly` is true.
   * @param dbName Database file name and default connection key.
   * @param location Directory relative to the platform database directory.
   * @param readOnly Open an existing database without write access.
   */
  open(dbName: string, location?: string, readOnly?: boolean): void
  /** Open a separate native handle, even when the database file is already open.
   * Independent connections require a thread-safe SQLite build.
   * @param dbName Database file name.
   * @param location Directory relative to the platform database directory.
   * @param readOnly Open an existing database without write access.
   * @returns An opaque ID to pass to native connection operations.
   */
  openConnection(dbName: string, location?: string, readOnly?: boolean): string
  /** Check whether a native connection ID is still open.
   * @param connectionId ID returned by `openConnection`.
   */
  isConnectionOpen(connectionId: string): boolean
  /** Close a default connection by name or an independent connection by ID. */
  close(dbName: string): void
  /** Delete a database and close the indicated connection if open.
   * Deletion fails while another connection or attachment uses the database file.
   * @param dbName Database file name.
   * @param location Directory relative to the platform database directory.
   * @param connectionId Optional ID of the independent connection to close.
   */
  drop(dbName: string, location?: string, connectionId?: string): void
  /** Attach a database file to an open main database under an SQL schema alias.
   * @param mainDbName Name of the open main database.
   * @param dbNameToAttach File name of the database to attach.
   * @param alias SQL schema name for the attached database.
   * @param location Directory relative to the platform database directory.
   */

  attach(
    mainDbName: string,
    dbNameToAttach: string,
    alias: string,
    location?: string,
  ): void
  /** Detach an attached database by its alias.
   * @param mainDbName Name of the open main database.
   * @param alias SQL schema name used when attaching.
   */
  detach(mainDbName: string, alias: string): void
  /** Execute one SQL statement synchronously on the calling thread.
   * @param dbName Name of an open database.
   * @param query SQL statement with optional positional placeholders.
   * @param params Positional values bound to SQL placeholders.
   * @returns Native query rows, affected row count, insert ID, and metadata.
   */
  execute(
    dbName: string,
    query: string,
    params?: SQLiteQueryParams,
  ): NitroSQLiteQueryResult
  /** Execute one SQL statement on a background thread.
   * @param dbName Name of an open database.
   * @param query SQL statement with optional positional placeholders.
   * @param params Positional values bound to SQL placeholders.
   * @returns A promise of the native query result.
   */
  executeAsync(
    dbName: string,
    query: string,
    params?: SQLiteQueryParams,
  ): Promise<NitroSQLiteQueryResult>
  /** Prepare one SQL statement on an open native connection for repeated execution.
   * Finalize the returned statement before closing its connection.
   * @param dbName Name or ID of an open database connection.
   * @param query SQL statement with optional positional placeholders.
   * @returns A native statement with synchronous and asynchronous execution methods.
   */
  prepare(dbName: string, query: string): NitroSQLitePreparedStatement
  /** Execute commands in one exclusive transaction on the calling thread.
   * An empty batch throws; a failed command rolls back the batch.
   * @param dbName Name of an open database.
   * @param commands SQL commands and optional parameter sets.
   * @returns Total affected row count.
   */
  executeBatch(dbName: string, commands: BatchQueryCommand[]): BatchQueryResult
  /** Execute commands in one exclusive transaction on a background thread.
   * An empty batch rejects; a failed command rolls back the batch.
   * @param dbName Name of an open database.
   * @param commands SQL commands and optional parameter sets.
   * @returns A promise of the total affected row count.
   */
  executeBatchAsync(
    dbName: string,
    commands: BatchQueryCommand[],
  ): Promise<BatchQueryResult>
  /** Import a SQL file in one exclusive transaction on the calling thread.
   * Each non-empty line is treated as one statement.
   * @param dbName Name of an open database.
   * @param location Path to the SQL file.
   * @returns Number of executed commands and affected rows.
   */
  loadFile(dbName: string, location: string): FileLoadResult
  /** Import a SQL file on a background thread.
   * @param dbName Name of an open database.
   * @param location Path to the SQL file.
   * @returns A promise of the command and affected row counts.
   */
  loadFileAsync(dbName: string, location: string): Promise<FileLoadResult>
}
