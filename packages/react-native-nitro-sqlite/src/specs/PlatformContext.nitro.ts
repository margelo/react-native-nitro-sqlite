import { Android, iOS, type HybridObject } from 'react-native-nitro-modules'

export * from '#nitro/PlatformContext'

/** Platform directories that a `NitroSQLite` root stores its databases in. */
@iOS({
  language: 'c++',
  implementation: {
    className: 'HybridPlatformContext',
    include: '"hybridObjects/HybridPlatformContext.hpp"',
  },
})
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridPlatformContext' },
})
export declare class PlatformContext extends HybridObject {
  /** Directory that database names and relative locations resolve against.
   * On Apple platforms, the `RNNitroSQLite_AppGroup` and
   * `RNNitroSQLite_DatabaseLocation` Info.plist keys select it.
   * @throws If the configured app group container doesn't exist or the
   * directory can't be created.
   */
  static readonly databaseDirectory: string
  /** Directory for SQLite's temporary files, when the platform has no usable default. */
  static readonly temporaryDirectory?: string
  /** Directory that databases are moved out of when they are opened, attached, or dropped.
   * Set when the app stores databases somewhere other than earlier versions did.
   */
  static readonly legacyDatabaseDirectory?: string
}
