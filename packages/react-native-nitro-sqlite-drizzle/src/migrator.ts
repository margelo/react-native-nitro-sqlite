import { useEffect, useState } from 'react'
import type { MigrationMeta } from 'drizzle-orm/migrator'
import type { NitroSQLiteDatabase } from './driver'
import './drizzle-orm'

const pendingMigrations = new WeakMap<object, Promise<void>>()

/** Bundled SQL and journal metadata exported by drizzle-kit's `migrations.js`. */
export interface MigrationConfig {
  /** Generated journal listing migrations in application order. */
  journal: {
    /** Migration indexes, creation timestamps, file tags, and statement-breakpoint settings. */
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[]
  }
  /** SQL strings keyed by the journal index, such as `m0000`. */
  migrations: Record<string, string>
}

/**
 * Apply the migrations that drizzle-kit generated and that have not run on this database yet.
 * Pending migrations run in one transaction and roll back together on failure.
 * Calls sharing a connection wait for earlier calls before reading migration history.
 * A failed call does not prevent later calls from retrying.
 * @typeParam TSchema Tables and relations supplied to Drizzle.
 * @param db Database returned by `drizzle()`.
 * @param config The `migrations.js` module that drizzle-kit generates.
 * @returns Resolves when all pending migrations finish.
 * @throws Rejects if a journal entry has no SQL, or a query or transaction fails.
 */
export async function migrate<TSchema extends Record<string, unknown>>(
  db: NitroSQLiteDatabase<TSchema>,
  config: MigrationConfig,
): Promise<void> {
  const connection = db.$client ?? db.session
  const previous = pendingMigrations.get(connection) ?? Promise.resolve()
  const pending = previous
    .catch(() => undefined)
    .then(() => db.dialect.migrate(readMigrationFiles(config), db.session))
  pendingMigrations.set(connection, pending)

  try {
    await pending
  } finally {
    if (pendingMigrations.get(connection) === pending) {
      pendingMigrations.delete(connection)
    }
  }
}

/** Result of the migration attempt for the hook's current inputs. */
export interface MigrationState {
  /** True after all pending migrations finish successfully. */
  success: boolean
  /** Failure from the migration attempt; absent while pending or after success. */
  error?: Error
}

/**
 * Run {@linkcode migrate} on mount and when the database or migration bundle changes.
 * Concurrent calls on the same connection are serialized, including Strict Mode
 * effect replays. Results from earlier inputs or after unmount do not update state.
 * @typeParam TSchema Tables and relations supplied to Drizzle.
 * @param db Database returned by `drizzle()`.
 * @param migrations The `migrations.js` module that drizzle-kit generates.
 * @returns `success` once the migrations finished, or the `error` they failed with.
 */
export function useMigrations<TSchema extends Record<string, unknown>>(
  db: NitroSQLiteDatabase<TSchema>,
  migrations: MigrationConfig,
): MigrationState {
  const [state, setState] = useState<MigrationState>({ success: false })

  useEffect(() => {
    let active = true
    setState({ success: false })
    migrate(db, migrations)
      .then(() => {
        if (active) setState({ success: true })
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          })
        }
      })
    return () => {
      active = false
    }
  }, [db, migrations])

  return state
}

function readMigrationFiles({
  journal,
  migrations,
}: MigrationConfig): MigrationMeta[] {
  return journal.entries.map((entry) => {
    const query = migrations[`m${entry.idx.toString().padStart(4, '0')}`]
    if (!query) {
      throw new Error(`Missing migration: ${entry.tag}`)
    }
    return {
      sql: query.split('--> statement-breakpoint'),
      bps: entry.breakpoints,
      folderMillis: entry.when,
      hash: '',
    }
  })
}
