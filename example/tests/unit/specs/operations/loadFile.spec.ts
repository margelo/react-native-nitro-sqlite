import { Platform, Settings } from 'react-native'
import { expect } from '@tests/unit/common'
import { describe, it } from '@tests/TestApi'
import { testDb } from '@tests/db'

export default function registerLoadFileUnitTests() {
  if (Platform.OS !== 'ios') {
    return
  }

  const loadFileFixturePath = Settings.get('loadFileFixturePath')

  describe('loadFile', () => {
    it('preserves the SQL error context and rolls back the completed commands', () => {
      expect(loadFileFixturePath).toBeTypeOf('string')
      testDb.execute(
        'CREATE TABLE LoadFileRegression (value TEXT NOT NULL) STRICT;',
      )

      let errorMessage: string | undefined
      try {
        testDb.loadFile(loadFileFixturePath as string)
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error
        }

        errorMessage = error.message
      }

      expect(errorMessage).toContain('Could not load file:')
      expect(errorMessage).toContain('load-file-with-error.sql')
      expect(errorMessage).toContain('line 2')
      expect(errorMessage).toContain('THIS IS NOT VALID SQL;')
      expect(errorMessage).toContain('syntax error')

      const rollbackResult = testDb.execute(
        'SELECT COUNT(*) AS count FROM LoadFileRegression;',
      )
      expect(rollbackResult.rows?._array).toEqual([{ count: 0 }])

      testDb.execute(
        "INSERT INTO LoadFileRegression (value) VALUES ('connection remains usable');",
      )
      const usableConnectionResult = testDb.execute(
        'SELECT COUNT(*) AS count FROM LoadFileRegression;',
      )
      expect(usableConnectionResult.rows?._array).toEqual([{ count: 1 }])
    })
  })
}
