import type { MochaTestResult } from './MochaSetup'

type SuiteResult = Extract<MochaTestResult, { type: 'suite' }>
type TestResult = Extract<MochaTestResult, { type: 'test' }>

export type VisibleTestResult =
  | {
      result: SuiteResult
      depth: number
      expanded: boolean
      passed: number
      failed: number
    }
  | { result: TestResult; depth: number }

export function getVisibleTestResults(
  results: readonly MochaTestResult[],
  expansionOverrides: ReadonlyMap<string, boolean>,
): VisibleTestResult[] {
  const children = new Map<string | null, MochaTestResult[]>()
  const suiteParents = new Map<string, string | null>()
  const counts = new Map<string, { passed: number; failed: number }>()

  for (const result of results) {
    const siblings = children.get(result.parentId) ?? []
    siblings.push(result)
    children.set(result.parentId, siblings)

    if (result.type === 'suite') suiteParents.set(result.id, result.parentId)
  }

  for (const result of results) {
    if (result.type !== 'test') continue

    let suiteId = result.parentId
    while (suiteId !== null) {
      const count = counts.get(suiteId) ?? { passed: 0, failed: 0 }
      count[result.status] += 1
      counts.set(suiteId, count)
      suiteId = suiteParents.get(suiteId) ?? null
    }
  }

  const visible: VisibleTestResult[] = []

  function visit(parentId: string | null, depth: number): void {
    for (const result of children.get(parentId) ?? []) {
      if (result.type === 'test') {
        visible.push({ result, depth })
        continue
      }

      const expanded = expansionOverrides.get(result.id) ?? depth === 0
      const count = counts.get(result.id) ?? { passed: 0, failed: 0 }
      visible.push({ result, depth, expanded, ...count })
      if (expanded) visit(result.id, depth + 1)
    }
  }

  visit(null, 0)
  return visible
}
