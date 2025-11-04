import { beforeEach, describe } from '../MochaRNAdapter'
import { setupTestDb } from './common'
import registerExecuteUnitTests from './specs/execute.spec'
import registerTransactionUnitTests from './specs/transaction.spec'
import registerExecuteBatchUnitTests from './specs/executeBatch.spec'
import registerTypeORMUnitTestsSpecs from './specs/typeorm.spec'

export function registerUnitTests() {
  beforeEach(setupTestDb)

  describe('Operations', () => {
    registerExecuteUnitTests()
    registerTransactionUnitTests()
    registerExecuteBatchUnitTests()
  })
}

export function registerTypeORMUnitTests() {
  registerTypeORMUnitTestsSpecs()
}
