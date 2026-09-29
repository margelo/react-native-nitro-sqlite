import '@/initGlobals'
import { registerSqliteVecUnitTests } from '@tests/unit'
import init from './init'

init()
registerSqliteVecUnitTests()
