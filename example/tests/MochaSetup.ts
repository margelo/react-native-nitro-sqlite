import 'mocha'
import { createMochaTestApi } from './MochaRNAdapter'
import { setTestApi } from './TestApi'

export type MochaTestResult =
  | { type: 'suite'; id: string; parentId: string | null; title: string }
  | {
      type: 'test'
      id: string
      parentId: string | null
      title: string
      status: 'passed'
    }
  | {
      type: 'test'
      id: string
      parentId: string | null
      title: string
      status: 'failed'
      errorMsg: string
    }

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
    const suiteIds = new Map<Mocha.Suite, string>()
    let nextId = 0

    runner
      .on(EVENT_SUITE_BEGIN, (startedSuite) => {
        if (startedSuite.title !== '') {
          const id = `suite-${nextId++}`
          suiteIds.set(startedSuite, id)
          onResult({
            type: 'suite',
            id,
            parentId: getParentId(startedSuite.parent, suite, suiteIds),
            title: startedSuite.title,
          })
        }
      })
      .on(EVENT_TEST_PASS, (test) => {
        onResult({
          type: 'test',
          id: `test-${nextId++}`,
          parentId: getParentId(test.parent, suite, suiteIds),
          title: test.title,
          status: 'passed',
        })
      })
      .on(EVENT_TEST_FAIL, (test, error: Error) => {
        onResult({
          type: 'test',
          id: `test-${nextId++}`,
          parentId: getParentId(test.parent, suite, suiteIds),
          title: test.title,
          status: 'failed',
          errorMsg: error.message,
        })
      })
      .once(EVENT_RUN_END, resolve)

    runner.run()
  })
}

function getParentId(
  parent: Mocha.Suite | undefined,
  root: Mocha.Suite,
  suiteIds: Map<Mocha.Suite, string>,
): string | null {
  if (!parent || parent === root) return null
  return suiteIds.get(parent) ?? null
}
