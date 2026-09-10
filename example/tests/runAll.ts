import { runTests } from './MochaSetup'
import {
  registerSqliteVecUnitTests,
  registerTypeORMUnitTests,
  registerUnitTests,
} from './unit'

export function runAllTests() {
  return runTests(
    registerUnitTests,
    registerTypeORMUnitTests,
    registerSqliteVecUnitTests,
  )
}
