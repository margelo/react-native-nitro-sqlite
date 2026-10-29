import type { BenchmarkCase } from './runner'
import { writeCases } from './writeCases'
import { readCases } from './readCases'
import { mixedCase } from './mixedCase'
import { chatCases } from './chatCases'
import { storageCases } from './storageCases'

export const benchmarkCases: BenchmarkCase[] = [
  ...writeCases,
  ...readCases,
  mixedCase,
  ...chatCases,
  ...storageCases,
]
