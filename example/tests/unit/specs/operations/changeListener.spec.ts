import type { DatabaseChange } from 'react-native-nitro-sqlite'
import { expect } from '@tests/unit/common'
import { beforeEach, describe, it } from '@tests/TestApi'
import { testDb } from '@tests/db'

type Batches = DatabaseChange[][]

const change = (
  operation: DatabaseChange['operation'],
  rowId: number,
  table = 'Note',
): DatabaseChange => ({ operation, database: 'main', table, rowId })

// Listeners run in a later JavaScript task, so wait until the expected number of batches arrived.
async function waitForBatches(batches: Batches, count: number) {
  for (let attempt = 0; attempt < 200 && batches.length < count; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  expect(batches.length).toBe(count)
}

function listen() {
  const batches: Batches = []
  const subscription = testDb.addChangeListener((changes) =>
    batches.push(changes),
  )
  return { batches, subscription }
}

export default function registerChangeListenerUnitTests() {
  describe('change listeners', () => {
    beforeEach(() => {
      testDb.execute('DROP TABLE IF EXISTS Note')
      testDb.execute(
        'CREATE TABLE Note (id INTEGER PRIMARY KEY, body TEXT NOT NULL)',
      )
    })

    it('reports each write outside a transaction on its own', async () => {
      const { batches, subscription } = listen()
      testDb.execute("INSERT INTO Note (id, body) VALUES (1, 'a')")
      testDb.execute("UPDATE Note SET body = 'b' WHERE id = 1")
      testDb.execute('DELETE FROM Note WHERE id = 1')

      await waitForBatches(batches, 3)
      expect(batches).toEqual([
        [change('insert', 1)],
        [change('update', 1)],
        [change('delete', 1)],
      ])
      subscription.remove()
    })

    it('reports a committed transaction once and drops a rolled-back one', async () => {
      const { batches, subscription } = listen()
      await testDb.transaction(async (tx) => {
        tx.execute("INSERT INTO Note (id, body) VALUES (1, 'a')")
        await tx.executeAsync("INSERT INTO Note (id, body) VALUES (2, 'b')")
      })
      await testDb
        .transaction(async (tx) => {
          tx.execute("INSERT INTO Note (id, body) VALUES (3, 'c')")
          throw new Error('roll back')
        })
        .catch(() => {})
      testDb.execute("INSERT INTO Note (id, body) VALUES (4, 'd')")

      await waitForBatches(batches, 2)
      expect(batches).toEqual([
        [change('insert', 1), change('insert', 2)],
        [change('insert', 4)],
      ])
      subscription.remove()
    })

    it('drops the changes of a failed statement but keeps the rest of its transaction', async () => {
      const { batches, subscription } = listen()
      await testDb.transaction(async (tx) => {
        tx.execute("INSERT INTO Note (id, body) VALUES (1, 'a')")
        try {
          // Inserts row 10, then fails on the duplicate key, so SQLite undoes row 10.
          tx.execute("INSERT INTO Note (id, body) VALUES (10, 'x'), (1, 'y')")
          throw new Error('Expected the duplicate key to fail')
        } catch (error) {
          if ((error as Error).message.startsWith('Expected')) throw error
        }
      })

      await waitForBatches(batches, 1)
      expect(batches).toEqual([[change('insert', 1)]])
      subscription.remove()
    })

    it('reports async queries, batches, and prepared statements', async () => {
      const { batches, subscription } = listen()
      await testDb.executeAsync("INSERT INTO Note (id, body) VALUES (1, 'a')")
      await testDb.executeBatchAsync([
        {
          query: 'INSERT INTO Note (id, body) VALUES (?, ?)',
          params: [
            [2, 'b'],
            [3, 'c'],
          ],
        },
      ])
      const statement = testDb.prepare('DELETE FROM Note WHERE id = ?')
      try {
        await statement.executeAsync([2])
      } finally {
        statement.finalize()
      }

      await waitForBatches(batches, 3)
      expect(batches).toEqual([
        [change('insert', 1)],
        [change('insert', 2), change('insert', 3)],
        [change('delete', 2)],
      ])
      subscription.remove()
    })

    it('stops calling a removed listener', async () => {
      const removed = listen()
      const kept = listen()
      removed.subscription.remove()
      testDb.execute("INSERT INTO Note (id, body) VALUES (1, 'a')")

      await waitForBatches(kept.batches, 1)
      expect(removed.batches).toEqual([])
      kept.subscription.remove()
    })

    it('lets a listener query the database', async () => {
      const bodies: unknown[] = []
      const subscription = testDb.addChangeListener(([first]) => {
        bodies.push(
          testDb.execute('SELECT body FROM Note WHERE rowid = ?', [
            first!.rowId,
          ]).rows._array[0]?.body,
        )
      })
      testDb.execute("INSERT INTO Note (id, body) VALUES (7, 'seven')")

      for (let attempt = 0; attempt < 200 && bodies.length === 0; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
      expect(bodies).toEqual(['seven'])
      subscription.remove()
    })
  })
}
