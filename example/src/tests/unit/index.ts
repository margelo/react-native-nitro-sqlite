import { beforeEach, describe } from '../MochaRNAdapter'
import { setupTestDb } from './common'
import registerExecuteUnitTests from './specs/operations/execute.spec'
import registerTransactionUnitTests from './specs/operations/transaction.spec'
import registerExecuteBatchUnitTests from './specs/operations/executeBatch.spec'
import registerTypeORMUnitTestsSpecs from './specs/typeorm.spec'
import registerDatabaseQueueUnitTests from './specs/DatabaseQueue.spec'

export function registerUnitTests() {
  beforeEach(setupTestDb)

  describe('Operations', () => {
    registerExecuteUnitTests()
    registerTransactionUnitTests()
    registerExecuteBatchUnitTests()
  })

  registerDatabaseQueueUnitTests()
}

export function registerTypeORMUnitTests() {
  registerTypeORMUnitTestsSpecs()
}
