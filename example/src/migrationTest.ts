import type { NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import { open } from 'react-native-nitro-sqlite'

const MAIN_DATABASE = 'migration-screen-main.sqlite'
const ATTACHED_DATABASE = 'migration-screen-attached.sqlite'
const ATTACHED_ALIAS = 'migration_attached'

type DatabaseSchema = 'main' | typeof ATTACHED_ALIAS
type DatabaseLocation = 'Documents' | 'Library/Application Support'

type DatabaseListRow = {
  name: string
  file: string
}

type MarkerRow = { marker: string }
type IntegrityRow = { integrity_check: string }

export type MigrationFixture = {
  marker: string
  mainPath: string
  attachedPath: string
}

export function seedMigrationFixture(): MigrationFixture {
  const marker = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  return {
    marker,
    mainPath: seedDatabase(MAIN_DATABASE, marker),
    attachedPath: seedDatabase(ATTACHED_DATABASE, marker),
  }
}

export function verifyMigrationFixture(
  expectedMarker: string,
): MigrationFixture {
  const marker = expectedMarker.trim()
  if (marker.length === 0) {
    throw new Error(
      'Enter the marker from the Documents build before verifying.',
    )
  }

  const database = open({ name: MAIN_DATABASE })
  try {
    // The attached database must migrate through attach(), not a separate open().
    database.attach(ATTACHED_DATABASE, ATTACHED_ALIAS)

    const mainPath = getDatabasePath(database, 'main')
    const attachedPath = getDatabasePath(database, ATTACHED_ALIAS)
    expectLocation(mainPath, MAIN_DATABASE, 'Library/Application Support')
    expectLocation(
      attachedPath,
      ATTACHED_DATABASE,
      'Library/Application Support',
    )

    expectMarker(database, 'main', marker)
    expectMarker(database, ATTACHED_ALIAS, marker)
    expectIntegrity(database, 'main')
    expectIntegrity(database, ATTACHED_ALIAS)

    return { marker, mainPath, attachedPath }
  } finally {
    database.close()
  }
}

function seedDatabase(name: string, marker: string): string {
  const database = open({ name })
  try {
    const path = getDatabasePath(database, 'main')
    expectLocation(path, name, 'Documents')

    database.execute(
      'CREATE TABLE IF NOT EXISTS migration_marker (marker TEXT NOT NULL)',
    )
    database.execute('DELETE FROM migration_marker')
    database.execute('INSERT INTO migration_marker (marker) VALUES (?)', [
      marker,
    ])

    return path
  } finally {
    database.close()
  }
}

function getDatabasePath(
  database: NitroSQLiteConnection,
  schema: DatabaseSchema,
): string {
  const row = database
    .execute<DatabaseListRow>('PRAGMA database_list')
    .rows._array.find((entry) => entry.name === schema)

  if (typeof row?.file !== 'string' || row.file.length === 0) {
    throw new Error(`SQLite did not report a file path for ${schema}.`)
  }

  return row.file
}

function expectLocation(
  path: string,
  name: string,
  location: DatabaseLocation,
): void {
  if (path.endsWith(`/${location}/${name}`)) {
    return
  }

  throw new Error(
    `Expected ${name} in ${location}, but SQLite opened ${path}. Check the example app's Info.plist setting and rebuild the native app.`,
  )
}

function expectMarker(
  database: NitroSQLiteConnection,
  schema: DatabaseSchema,
  expectedMarker: string,
): void {
  const query =
    schema === 'main'
      ? 'SELECT marker FROM main.migration_marker LIMIT 1'
      : `SELECT marker FROM ${ATTACHED_ALIAS}.migration_marker LIMIT 1`
  const marker = database.execute<MarkerRow>(query).rows.item(0)?.marker

  if (marker === expectedMarker) {
    return
  }

  throw new Error(
    `${schema} did not contain the marker from the Documents build. Found ${String(marker)}.`,
  )
}

function expectIntegrity(
  database: NitroSQLiteConnection,
  schema: DatabaseSchema,
): void {
  const result = database
    .execute<IntegrityRow>(`PRAGMA ${schema}.integrity_check`)
    .rows.item(0)?.integrity_check

  if (result === 'ok') {
    return
  }

  throw new Error(`${schema} failed SQLite integrity_check: ${String(result)}.`)
}
