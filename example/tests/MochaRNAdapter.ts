import 'mocha'
import type * as MochaTypes from 'mocha'
import { expect as chaiExpect } from 'chai'
import type { TestExpect } from './TestApi'

export const rootSuite = new Mocha.Suite('')
rootSuite.timeout(10 * 1000)

let mochaContext = rootSuite
let only = false

export const clearTests = () => {
  rootSuite.suites = []
  rootSuite.tests = []
  mochaContext = rootSuite
  only = false
}

export const it = (
  name: string,
  f: MochaTypes.Func | MochaTypes.AsyncFunc,
): void => {
  if (!only) {
    const test = new Mocha.Test(name, f)
    mochaContext.addTest(test)
  }
}

export const itOnly = (
  name: string,
  f: MochaTypes.Func | MochaTypes.AsyncFunc,
): void => {
  clearTests()
  const test = new Mocha.Test(name, f)
  mochaContext.addTest(test)
  only = true
}

export const describe = (name: string, f: () => void): void => {
  const prevMochaContext = mochaContext
  mochaContext = new Mocha.Suite(name, prevMochaContext.ctx)
  prevMochaContext.addSuite(mochaContext)
  f()
  mochaContext = prevMochaContext
}

export const beforeEach = (f: MochaTypes.Func | MochaTypes.AsyncFunc) =>
  mochaContext.beforeEach(f)
export const beforeEachAsync = (f: Mocha.AsyncFunc) =>
  mochaContext.beforeEach(f)

export const beforeAll = (f: MochaTypes.Func | MochaTypes.AsyncFunc) =>
  mochaContext.beforeAll(f)
export const beforeAllAsync = (f: MochaTypes.AsyncFunc) =>
  mochaContext.beforeAll(f)

export const afterEach = (f: MochaTypes.Func | MochaTypes.AsyncFunc) =>
  mochaContext.afterEach(f)
export const afterEachAsync = (f: Mocha.AsyncFunc) => mochaContext.afterEach(f)

export const afterAll = (f: MochaTypes.Func | MochaTypes.AsyncFunc) =>
  mochaContext.afterAll(f)
export const afterAllAsync = (f: MochaTypes.AsyncFunc) =>
  mochaContext.afterAll(f)

export function expect(value: unknown): TestExpect {
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
