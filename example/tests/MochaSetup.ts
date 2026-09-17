import Mocha from 'mocha'
import { createMochaTestApi } from './MochaRNAdapter'
import { setTestApi } from './TestApi'

export type MochaTestResult =
  | { type: 'grouping'; key: string; description: string }
  | { type: 'correct'; key: string; description: string }
  | { type: 'incorrect'; key: string; description: string; errorMsg: string }

export async function runTests(
  onResult: (result: MochaTestResult) => void,
  ...registrators: (() => void)[]
): Promise<void> {
  const { suite, api } = createMochaTestApi()
  setTestApi(api)
  registrators.forEach((register) => register())

  await new Promise<void>((resolve) => {
    const {
      EVENT_RUN_END,
      EVENT_TEST_FAIL,
      EVENT_TEST_PASS,
      EVENT_SUITE_BEGIN,
    } = Mocha.Runner.constants
    const runner = new Mocha.Runner(suite)
    let nextKey = 0

    runner
      .on(EVENT_SUITE_BEGIN, (startedSuite) => {
        if (startedSuite.title !== '') {
          onResult({
            type: 'grouping',
            key: String(nextKey++),
            description: startedSuite.fullTitle().trim(),
          })
        }
      })
      .on(EVENT_TEST_PASS, (test) => {
        onResult({
          type: 'correct',
          key: String(nextKey++),
          description: test.fullTitle().trim(),
        })
      })
      .on(EVENT_TEST_FAIL, (test, error: Error) => {
        onResult({
          type: 'incorrect',
          key: String(nextKey++),
          description: test.fullTitle().trim(),
          errorMsg: error.message,
        })
      })
      .once(EVENT_RUN_END, resolve)

    runner.run()
  })
}
