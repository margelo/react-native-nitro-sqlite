import { useEffect, useState } from 'react'
import type { MigrationMeta } from 'drizzle-orm/migrator'
import type { NitroSQLiteDatabase } from './driver'

interface MigrationConfig {
  journal: {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[]
  }
  migrations: Record<string, string>
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

/**
 * Apply the migrations that drizzle-kit generated and that have not run on this database yet.
 * @param db Database returned by `drizzle()`.
 * @param config The `migrations.js` module that drizzle-kit generates.
 */
export async function migrate<TSchema extends Record<string, unknown>>(
  db: NitroSQLiteDatabase<TSchema>,
  config: MigrationConfig,
): Promise<void> {
  return db.dialect.migrate(readMigrationFiles(config), db.session)
}

interface State {
  success: boolean
  error?: Error
}

/**
 * Run {@linkcode migrate} once when the component mounts.
 * @param db Database returned by `drizzle()`.
 * @param migrations The `migrations.js` module that drizzle-kit generates.
 * @returns `success` once the migrations finished, or the `error` they failed with.
 */
export function useMigrations<TSchema extends Record<string, unknown>>(
  db: NitroSQLiteDatabase<TSchema>,
  migrations: MigrationConfig,
): State {
  const [state, setState] = useState<State>({ success: false })

  useEffect(() => {
    setState({ success: false })
    migrate(db, migrations)
      .then(() => setState({ success: true }))
      .catch((error: Error) => setState({ success: false, error }))
  }, [db, migrations])

  return state
}
