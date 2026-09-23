import type { MochaTestResult } from './MochaSetup'
import { runTests } from './MochaSetup'
import {
  registerSqliteVecUnitTests,
  registerTypeORMUnitTests,
  registerUnitTests,
} from './unit'

export async function runAllTests(): Promise<MochaTestResult[]> {
  const results: MochaTestResult[] = []

  await runTests(
    (result) => results.push(result),
    registerUnitTests,
    registerTypeORMUnitTests,
    registerSqliteVecUnitTests,
  )

  return results
}
