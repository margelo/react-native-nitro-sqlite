import { beforeEach, describe } from '../TestApi'
import { setupTestDb } from './common'
import registerExecuteUnitTests from './specs/operations/execute.spec'
import registerTransactionUnitTests from './specs/operations/transaction.spec'
import registerExecuteBatchUnitTests from './specs/operations/executeBatch.spec'
import registerPreparedStatementUnitTests from './specs/operations/preparedStatement.spec'
import registerTypeORMUnitTestsSpecs from './specs/typeorm.spec'
import registerDatabaseQueueUnitTests from './specs/DatabaseQueue.spec'
import registerSqliteVecUnitTestsSpecs from './specs/sqlite-vec.spec'

export function registerUnitTests() {
  beforeEach(setupTestDb)

  describe('operations/execute.spec.ts', registerExecuteUnitTests)
  describe('operations/transaction.spec.ts', registerTransactionUnitTests)
  describe('operations/executeBatch.spec.ts', registerExecuteBatchUnitTests)
  describe(
    'operations/preparedStatement.spec.ts',
    registerPreparedStatementUnitTests,
  )
  describe('DatabaseQueue.spec.ts', registerDatabaseQueueUnitTests)
}

export function registerTypeORMUnitTests() {
  describe('typeorm.spec.ts', registerTypeORMUnitTestsSpecs)
}

export function registerSqliteVecUnitTests() {
  describe('sqlite-vec.spec.ts', registerSqliteVecUnitTestsSpecs)
}
