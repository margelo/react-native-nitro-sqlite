/** Optional native settings applied during Expo prebuild. Rebuild after changing them. */
export interface NitroSQLitePluginOptions {
  /** Enable bundled SQLite's FTS5 module on both platforms. Defaults to false; does not disable manually enabled FTS5. */
  fts5?: boolean
  /** Additional compile definitions. Duplicate definitions merge; conflicting values throw during prebuild. */
  sqliteFlags?: SQLiteFlags
  /** iOS storage and SQLite linkage settings. */
  ios?: NitroSQLiteIOSOptions
}

/** Advanced bundled SQLite compile definitions. Reserved safety and ABI definitions are rejected. */
export interface SQLiteFlags {
  /** Definitions such as `SQLITE_ENABLE_GEOPOLY=1`. Values must be integers or unquoted identifiers. */
  ios?: string[]
  /** Definitions such as `-DSQLITE_ENABLE_GEOPOLY=1`. Values must be integers or unquoted identifiers. */
  android?: string[]
}

/** Settings for the iOS app target and library pods. */
export interface NitroSQLiteIOSOptions {
  /** App Group identifier, beginning with `group.`. Adds the plist key and preserves existing app-target entitlements. Configure extensions separately. */
  appGroup?: string
  /** Link Apple's system SQLite. Defaults to bundled SQLite; its features and version depend on iOS. Cannot combine with iOS compile flags or FTS5. */
  useSystemSqlite?: boolean
}
