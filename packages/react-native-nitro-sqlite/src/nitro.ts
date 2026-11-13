import { NitroSQLite } from './specs/NitroSQLite.nitro'
import { PlatformContext } from './specs/PlatformContext.nitro'

export const HybridNitroSQLite = new NitroSQLite(
  PlatformContext.databaseDirectory,
  PlatformContext.temporaryDirectory,
  PlatformContext.legacyDatabaseDirectory,
)
