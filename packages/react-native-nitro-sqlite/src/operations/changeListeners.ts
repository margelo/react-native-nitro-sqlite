import { HybridNitroSQLite } from '../nitro'
import type {
  DatabaseChange,
  DatabaseChangeListener,
  DatabaseChangeSubscription,
} from '../types'

/** Change listeners of one managed connection. */
export interface ChangeListeners {
  /** Register a listener and enable native change reporting for the first one. */
  add(listener: DatabaseChangeListener): DatabaseChangeSubscription
  /** Drop all listeners after the native connection closed, which removed its handler. */
  clear(): void
}

/**
 * Track the change listeners of one connection. The native handler is set only
 * while at least one listener is registered, so SQLite records no changes otherwise.
 * @param connectionId Name or ID of the native connection.
 */
export function createChangeListeners(connectionId: string): ChangeListeners {
  const listeners = new Set<DatabaseChangeListener>()
  let closed = false

  const notify = (changes: DatabaseChange[]) => {
    for (const listener of [...listeners]) {
      try {
        listener(changes)
      } catch (error) {
        // Report the error without skipping the remaining listeners.
        setTimeout(() => {
          throw error
        })
      }
    }
  }

  return {
    add(listener) {
      // Wrap so that adding the same function twice creates two subscriptions.
      const entry: DatabaseChangeListener = (changes) => listener(changes)
      if (listeners.size === 0) {
        HybridNitroSQLite.setChangeHandler(connectionId, notify)
      }
      listeners.add(entry)

      return {
        remove() {
          const isLastListener = listeners.delete(entry) && listeners.size === 0
          if (isLastListener && !closed) {
            HybridNitroSQLite.setChangeHandler(connectionId)
          }
        },
      }
    },
    clear() {
      closed = true
      listeners.clear()
    },
  }
}
