import { open, type NitroSQLiteConnection } from 'react-native-nitro-sqlite'

export function createBenchmarkDatabase(
  name: string,
  schema: string,
): NitroSQLiteConnection {
  const db = open({ name })
  try {
    db.execute('DROP TABLE IF EXISTS Bench')
    db.execute(schema)
    return db
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

// Apps usually run SQLite in WAL mode, where synchronous=NORMAL commits
// without waiting for the disk.
export function createAppDatabase(
  name: string,
  schema: string[],
): NitroSQLiteConnection {
  open({ name }).delete()
  const db = open({ name })
  try {
    const mode = db
      .execute<{ journal_mode: string }>('PRAGMA journal_mode = WAL')
      .rows.item(0)?.journal_mode
    assertBenchmark(mode?.toLowerCase() === 'wal', 'WAL mode unavailable')
    db.execute('PRAGMA synchronous = NORMAL')
    db.executeBatch(schema.map((query) => ({ query })))
    return db
  } catch (error) {
    disposeBenchmarkDatabase(db)
    throw error
  }
}

export function disposeBenchmarkDatabase(db: NitroSQLiteConnection): void {
  db.close()
  db.delete()
}

export function assertBenchmark(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message)
}
