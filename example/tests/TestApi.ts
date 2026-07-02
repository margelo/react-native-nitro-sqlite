type TestCallback = () => void | Promise<void>

export type TestExpect = {
  toBe(expected: unknown): void
  toEqual(expected: unknown): void
  toContain(expected: unknown): void
  toHaveLength(expected: number): void
  toBeTypeOf(expected: string): void
  toBeInstanceOf(expected: unknown): void
  not: {
    toBe(expected: unknown): void
  }
}

export type TestApi = {
  describe(name: string, fn: TestCallback): void
  it(name: string, fn: TestCallback): void
  beforeEach(fn: TestCallback): void
  beforeAll(fn: TestCallback): void
  afterEach(fn: TestCallback): void
  afterAll(fn: TestCallback): void
  expect(value: unknown): TestExpect
}

let testApi: TestApi | undefined

function getTestApi() {
  if (testApi == null) {
    throw new Error('Test API has not been configured')
  }

  return testApi
}

export function setTestApi(api: TestApi) {
  testApi = api
}

export const describe: TestApi['describe'] = (name, fn) =>
  getTestApi().describe(name, fn)

export const it: TestApi['it'] = (name, fn) => getTestApi().it(name, fn)

export const beforeEach: TestApi['beforeEach'] = (fn) =>
  getTestApi().beforeEach(fn)

export const beforeAll: TestApi['beforeAll'] = (fn) =>
  getTestApi().beforeAll(fn)

export const afterEach: TestApi['afterEach'] = (fn) =>
  getTestApi().afterEach(fn)

export const afterAll: TestApi['afterAll'] = (fn) => getTestApi().afterAll(fn)

export const expect: TestApi['expect'] = (value) => getTestApi().expect(value)
