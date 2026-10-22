import { open, type Connection } from 'react-native-nitro-sqlite'

export function createBenchmarkDatabase(
  name: string,
  schema: string,
): Connection {
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

export function disposeBenchmarkDatabase(db: Connection): void {
  db.close()
  db.delete()
}

export function assertBenchmark(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message)
}
