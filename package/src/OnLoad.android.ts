import { NitroModules } from 'react-native-nitro-modules'
import { NitroSQLiteOnLoad as NitroSQLiteOnLoadSpec } from './specs/NitroSQLiteOnLoad.nitro'

const NitroSQLiteOnLoad =
  NitroModules.createHybridObject<NitroSQLiteOnLoadSpec>('NitroSQLiteOnLoad')
export const init = () => NitroSQLiteOnLoad.init()
