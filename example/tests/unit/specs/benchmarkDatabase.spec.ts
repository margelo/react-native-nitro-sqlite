import { describe, it } from '@tests/TestApi'
import { expect } from '@tests/unit/common'
import { resetLargeDbSchema } from '@tests/db'
import { open } from 'react-native-nitro-sqlite'

const DB_NAME = 'benchmark_schema_reset'

export default function registerBenchmarkDatabaseUnitTests() {
  describe('benchmark database', () => {
    it('rebuilds an existing benchmark table', () => {
      const db = open({ name: DB_NAME })

      try {
        db.execute('DROP TABLE IF EXISTS Test;')
        db.execute('CREATE TABLE Test (legacy TEXT);')

        resetLargeDbSchema(db)

        const columns = db.execute('PRAGMA table_info(Test);')
        expect(columns.rows?._array.map((column) => column.name)).toEqual([
          'id',
          'v1',
          'v2',
          'v3',
          'v4',
          'v5',
          'v6',
          'v7',
          'v8',
          'v9',
          'v10',
          'v11',
          'v12',
          'v13',
          'v14',
        ])
      } finally {
        db.close()
        db.delete()
      }
    })
  })
}
