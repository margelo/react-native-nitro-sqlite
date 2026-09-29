import { describe, expect, it, jest } from '@jest/globals'
import { runTests } from './MochaSetup'
import type { MochaTestResult } from './MochaSetup'
import {
  beforeEach as registerBeforeEach,
  describe as registerSuite,
  it as registerTest,
} from './TestApi'

jest.mock('mocha', () => {
  const Runtime: typeof Mocha = jest.requireActual('mocha')
  Object.assign(globalThis, { Mocha: Runtime })
  return { __esModule: true, default: {} }
})

describe('MochaSetup', () => {
  it('reports suites and test results as they finish', async () => {
    const results: MochaTestResult[] = []

    await runTests(
      (result) => results.push(result),
      () => {
        registerSuite('database', () => {
          registerTest('passes', () => {})
          registerTest('fails', () => {
            throw new Error('expected failure')
          })
        })
      },
    )

    expect(results).toEqual([
      { type: 'suite', id: 'suite-0', parentId: null, title: 'database' },
      {
        type: 'test',
        id: 'test-1',
        parentId: 'suite-0',
        title: 'passes',
        status: 'passed',
      },
      {
        type: 'test',
        id: 'test-2',
        parentId: 'suite-0',
        title: 'fails',
        status: 'failed',
        errorMsg: 'expected failure',
      },
    ])
  })

  it('starts each run with a fresh suite', async () => {
    const first: string[] = []
    const second: string[] = []

    await runTests(
      (result) => {
        if (result.type === 'test') first.push(result.title)
      },
      () => registerTest('first', () => {}),
    )
    await runTests(
      (result) => {
        if (result.type === 'test') second.push(result.title)
      },
      () => registerTest('second', () => {}),
    )

    expect(first).toEqual(['first'])
    expect(second).toEqual(['second'])
  })

  it('keeps parent hooks when registering nested and sibling tests', async () => {
    const calls: string[] = []
    const names: string[] = []
    const results: MochaTestResult[] = []

    await runTests(
      (result) => {
        results.push(result)
        if (result.type === 'test' && result.status === 'passed') {
          names.push(result.title)
        }
      },
      () => {
        registerSuite('outer', () => {
          registerBeforeEach(() => {
            calls.push('before')
          })
          registerSuite('inner', () => {
            registerTest('nested', () => {
              calls.push('nested')
            })
          })
          registerTest('sibling', () => {
            calls.push('sibling')
          })
        })
      },
    )

    expect(calls).toEqual(['before', 'sibling', 'before', 'nested'])
    expect(names).toEqual(['sibling', 'nested'])
    expect(results.map(({ id, parentId }) => [id, parentId])).toEqual([
      ['suite-0', null],
      ['test-1', 'suite-0'],
      ['suite-2', 'suite-0'],
      ['test-3', 'suite-2'],
    ])
  })

  it('runs root setup hooks for tests inside a file suite', async () => {
    const calls: string[] = []

    await runTests(
      () => {},
      () => {
        registerBeforeEach(() => {
          calls.push('setup')
        })
        registerSuite('example.spec.ts', () => {
          registerTest('uses setup', () => {
            calls.push('test')
          })
        })
      },
    )

    expect(calls).toEqual(['setup', 'test'])
  })

  it('reports the original setup error when a root hook fails', async () => {
    const results: MochaTestResult[] = []
    let testRan = false

    await runTests(
      (result) => results.push(result),
      () => {
        registerBeforeEach(() => {
          throw new Error('database open failed')
        })
        registerSuite('example.spec.ts', () => {
          registerTest('uses the database', () => {
            testRan = true
          })
        })
      },
    )

    expect(testRan).toBe(false)
    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'test',
          status: 'failed',
          errorMsg: 'database open failed',
        }),
      ]),
    )
  })

  it('rejects registration errors', async () => {
    await expect(
      runTests(
        () => {},
        () => {
          throw new Error('registration failed')
        },
      ),
    ).rejects.toThrow('registration failed')
  })
})
