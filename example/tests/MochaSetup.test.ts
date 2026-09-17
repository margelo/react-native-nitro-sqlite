import { describe, expect, it } from '@jest/globals'
import { runTests } from './MochaSetup'
import type { MochaTestResult } from './MochaSetup'
import {
  beforeEach as registerBeforeEach,
  describe as registerSuite,
  it as registerTest,
} from './TestApi'

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
      { type: 'grouping', key: '0', description: 'database' },
      { type: 'correct', key: '1', description: 'database passes' },
      {
        type: 'incorrect',
        key: '2',
        description: 'database fails',
        errorMsg: 'expected failure',
      },
    ])
  })

  it('starts each run with a fresh suite', async () => {
    const first: string[] = []
    const second: string[] = []

    await runTests(
      (result) => first.push(result.description),
      () => registerTest('first', () => {}),
    )
    await runTests(
      (result) => second.push(result.description),
      () => registerTest('second', () => {}),
    )

    expect(first).toEqual(['first'])
    expect(second).toEqual(['second'])
  })

  it('keeps parent hooks when registering nested and sibling tests', async () => {
    const calls: string[] = []
    const names: string[] = []

    await runTests(
      (result) => {
        if (result.type === 'correct') names.push(result.description)
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
    expect(names).toEqual(['outer sibling', 'outer inner nested'])
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
