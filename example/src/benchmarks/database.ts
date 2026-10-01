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
