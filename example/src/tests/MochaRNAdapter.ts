import 'mocha';
import type * as MochaTypes from 'mocha';

export const rootSuite = new Mocha.Suite('');
rootSuite.timeout(10 * 1000);

let mochaContext = rootSuite;
let only = false;

export const clearTests = () => {
  rootSuite.suites = [];
  rootSuite.tests = [];
  mochaContext = rootSuite;
  only = false;
};

export const it = (
  name: string,
  f: MochaTypes.Func | MochaTypes.AsyncFunc,
): void => {
  if (!only) {
    const test = new Mocha.Test(name, f);
    mochaContext.addTest(test);
  }
};

export const itOnly = (
  name: string,
  f: MochaTypes.Func | MochaTypes.AsyncFunc,
): void => {
  clearTests();
  const test = new Mocha.Test(name, f);
  mochaContext.addTest(test);
  only = true;
};

export const describe = (name: string, f: () => void): void => {
  const prevMochaContext = mochaContext;
  mochaContext = new Mocha.Suite(name, prevMochaContext.ctx);
  prevMochaContext.addSuite(mochaContext);
  f();
  mochaContext = prevMochaContext;
};

export const beforeEach = (f: Mocha.Func) => mochaContext.beforeEach(f);
export const beforeEachAsync = (f: Mocha.AsyncFunc) =>
  mochaContext.beforeEach(f);

export const beforeAll = (f: MochaTypes.Func) => mochaContext.beforeAll(f);
export const beforeAllAsync = (f: MochaTypes.AsyncFunc) =>
  mochaContext.beforeAll(f);
