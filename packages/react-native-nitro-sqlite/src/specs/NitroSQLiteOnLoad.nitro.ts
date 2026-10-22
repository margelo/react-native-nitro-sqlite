import { Android, type HybridObject } from 'react-native-nitro-modules'

export * from '#nitro/NitroSQLiteOnLoad'

/** Android startup hook that configures the native database directories. */
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridNitroSQLiteOnLoad' },
})
export declare class NitroSQLiteOnLoad extends HybridObject {
  /** Pass the app's files and cache directories from the application context to SQLite. */
  static init(): void
}
