import { describe, expect, it } from '@jest/globals'
import type { MochaTestResult } from './MochaSetup'
import { getVisibleTestResults } from './TestResultTree'

const results: MochaTestResult[] = [
  { type: 'suite', id: 'file', parentId: null, title: 'execute.spec.ts' },
  { type: 'suite', id: 'describe', parentId: 'file', title: 'execute' },
  {
    type: 'test',
    id: 'passed',
    parentId: 'describe',
    title: 'returns rows',
    status: 'passed',
  },
  { type: 'suite', id: 'nested', parentId: 'describe', title: 'errors' },
  {
    type: 'test',
    id: 'failed',
    parentId: 'nested',
    title: 'rejects invalid SQL',
    status: 'failed',
    errorMsg: 'invalid SQL',
  },
  { type: 'suite', id: 'other-file', parentId: null, title: 'typeorm.spec.ts' },
]

describe('getVisibleTestResults', () => {
  it('shows file groups and rolls counts up through nested suites', () => {
    const visible = getVisibleTestResults(results, new Map())

    expect(visible.map(({ result, depth }) => [result.id, depth])).toEqual([
      ['file', 0],
      ['describe', 1],
      ['other-file', 0],
    ])
    expect(visible[0]).toMatchObject({ passed: 1, failed: 1, expanded: true })
    expect(visible[1]).toMatchObject({ passed: 1, failed: 1, expanded: false })
  })

  it('expands nested suites and can collapse a file group', () => {
    const expanded = getVisibleTestResults(
      results,
      new Map([
        ['describe', true],
        ['nested', true],
      ]),
    )
    expect(expanded.map(({ result }) => result.id)).toEqual([
      'file',
      'describe',
      'passed',
      'nested',
      'failed',
      'other-file',
    ])

    const collapsed = getVisibleTestResults(results, new Map([['file', false]]))
    expect(collapsed.map(({ result }) => result.id)).toEqual([
      'file',
      'other-file',
    ])
  })
})
