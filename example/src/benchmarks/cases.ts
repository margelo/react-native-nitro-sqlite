import type { BenchmarkCase } from './runner'
import { writeCases } from './writeCases'
import { readCases } from './readCases'
import { mixedCase } from './mixedCase'

export const benchmarkCases: BenchmarkCase[] = [
  ...writeCases,
  ...readCases,
  mixedCase,
]
