import { NitroModules } from 'react-native-nitro-modules'
import type { NitroSQLite as NitroSQLiteSpec } from './specs/NitroSQLite.nitro'

export const HybridNitroSQLite =
  NitroModules.createHybridObject<NitroSQLiteSpec>('NitroSQLite')
