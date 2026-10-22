#pragma once

#include <optional>
#include <string>

namespace margelo::nitro::rnnitrosqlite {

/** Apple platform directories for NitroSQLite, implemented in ios/HybridPlatformContext.mm.
 * PlatformContext only has static members, so this class doesn't derive from its generated spec.
 * Android implements PlatformContext in Kotlin instead.
 */
class HybridPlatformContext {
public:
  /** Database directory selected by the RNNitroSQLite_AppGroup and RNNitroSQLite_DatabaseLocation Info.plist keys.
   * @throws std::runtime_error If the app group container doesn't exist or the directory can't be created.
   */
  static std::string getDatabaseDirectory();

  /** Apple platforms keep SQLite's default temporary directory, so this is always empty. */
  static std::optional<std::string> getTemporaryDirectory();

  /** The Documents directory when RNNitroSQLite_DatabaseLocation moves databases to Application Support. */
  static std::optional<std::string> getLegacyDatabaseDirectory();
};

} // namespace margelo::nitro::rnnitrosqlite
