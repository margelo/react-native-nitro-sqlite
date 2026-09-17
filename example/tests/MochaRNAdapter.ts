import 'mocha'
import { expect as chaiExpect } from 'chai'
import type { TestApi, TestExpect } from './TestApi'

export function createMochaTestApi(): { suite: Mocha.Suite; api: TestApi } {
  const suite = new Mocha.Suite('')
  suite.timeout(10 * 1000)
  let currentSuite = suite

  const api: TestApi = {
    describe(name, register) {
      const parent = currentSuite
      currentSuite = new Mocha.Suite(name, parent.ctx)
      parent.addSuite(currentSuite)

      try {
        register()
      } finally {
        currentSuite = parent
      }
    },
    it(name, run) {
      currentSuite.addTest(new Mocha.Test(name, run))
    },
    beforeEach(run) {
      currentSuite.beforeEach(run)
    },
    beforeAll(run) {
      currentSuite.beforeAll(run)
    },
    afterEach(run) {
      currentSuite.afterEach(run)
    },
    afterAll(run) {
      currentSuite.afterAll(run)
    },
    expect,
  }

  return { suite, api }
}

function expect(value: unknown): TestExpect {
  return {
    toBe: (expected: unknown) => chaiExpect(value).to.equal(expected),
    toEqual: (expected: unknown) => chaiExpect(value).to.eql(expected),
    toContain: (expected: unknown) => chaiExpect(value).to.include(expected),
    toHaveLength: (expected: number) =>
      chaiExpect(value).to.have.length(expected),
    toBeTypeOf: (expected: string) => chaiExpect(value).to.be.a(expected),
    toBeInstanceOf: (expected: unknown) =>
      chaiExpect(value).to.be.instanceOf(expected),
    not: {
      toBe: (expected: unknown) => chaiExpect(value).to.not.equal(expected),
    },
  }
}
