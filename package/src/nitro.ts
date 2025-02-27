import { NitroModules } from 'react-native-nitro-modules'
import type { NitroSQLite as NitroSQLiteSpec } from './specs/NitroSQLite.nitro'
import type { PendingTransaction } from './operations/transaction'
import { NitroSQLiteOnLoad as NitroSQLiteOnLoadSpec } from './specs/NitroSQLiteOnLoad.nitro'

const NitroSQLiteOnLoad =
  NitroModules.createHybridObject<NitroSQLiteOnLoadSpec>('NitroSQLiteOnLoad')
export const init = () => NitroSQLiteOnLoad.init()

export const HybridNitroSQLite =
  NitroModules.createHybridObject<NitroSQLiteSpec>('NitroSQLite')

export const locks: Record<
  string,
  { queue: PendingTransaction[]; inProgress: boolean }
> = {}
