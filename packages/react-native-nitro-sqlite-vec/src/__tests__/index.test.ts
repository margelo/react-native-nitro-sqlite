import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import {
  createVectorTable,
  isVecAvailable,
  knnSearch,
  vecVersion,
} from '../index'

const execute = jest.fn()
const db = { execute } as unknown as NitroSQLiteConnection

beforeEach(() => execute.mockReset())

describe('sqlite-vec helpers', () => {
  it('returns the linked version and reports availability', () => {
    execute.mockReturnValue({ rows: { _array: [{ value: 'v0.1.9' }] } })

    expect(vecVersion(db)).toBe('v0.1.9')
    expect(isVecAvailable(db)).toBe(true)
    expect(execute).toHaveBeenCalledWith('SELECT vec_version() AS value')
  })

  it('reports sqlite-vec as unavailable when the native query fails', () => {
    execute.mockImplementation(() => {
      throw new Error('no such function: vec_version')
    })

    expect(isVecAvailable(db)).toBe(false)
  })

  it('creates a vector table with defaults and optional storage settings', () => {
    createVectorTable(db, 'documents', { dimensions: 3 })
    createVectorTable(db, 'binary_documents', {
      dimensions: 8,
      type: 'bit',
      distanceMetric: 'cosine',
      column: 'features',
    })

    expect(execute).toHaveBeenNthCalledWith(
      1,
      'CREATE VIRTUAL TABLE IF NOT EXISTS documents USING vec0(embedding float[3]);',
    )
    expect(execute).toHaveBeenNthCalledWith(
      2,
      'CREATE VIRTUAL TABLE IF NOT EXISTS binary_documents USING vec0(features bit[8] distance_metric=cosine);',
    )
  })

  it('serializes array queries and returns KNN matches', () => {
    const matches = [{ rowid: 4, distance: 0.25 }]
    execute.mockReturnValue({ rows: { _array: matches } })

    expect(knnSearch(db, 'documents', [0.1, 0.2], 5)).toBe(matches)
    expect(execute).toHaveBeenCalledWith(
      'SELECT rowid, distance FROM documents WHERE embedding MATCH ? AND k = ? ORDER BY distance',
      ['[0.1,0.2]', 5],
    )
  })

  it('passes JSON queries through and supports a custom column', () => {
    execute.mockReturnValue({ rows: undefined })

    expect(
      knnSearch(db, 'documents', '[1,2]', 2, { column: 'features' }),
    ).toEqual([])
    expect(execute).toHaveBeenCalledWith(
      'SELECT rowid, distance FROM documents WHERE features MATCH ? AND k = ? ORDER BY distance',
      ['[1,2]', 2],
    )
  })
})
