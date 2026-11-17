import { ScrollView, StyleSheet, Text } from 'react-native'
import { open, type NitroSQLiteConnection } from 'react-native-nitro-sqlite'
import {
  createVectorTable,
  knnSearch,
  vecVersion,
} from 'react-native-nitro-sqlite-vec'

// Each check reads a feature that only exists when the config plugins ran during prebuild.
const checks = runChecks()

export default function App() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>Nitro SQLite Expo example</Text>
      {checks.map(({ name, result }) => (
        <Text
          key={name}
          style={styles.row}
        >
          {name}: {result}
        </Text>
      ))}
    </ScrollView>
  )
}

function runChecks() {
  const db = open({ name: 'expo-example.sqlite' })
  try {
    return [
      {
        name: 'SQLite',
        result: run(() => first(db, 'SELECT sqlite_version()')),
      },
      { name: 'FTS5', result: run(() => searchNotes(db)) },
      {
        name: 'Math functions',
        result: run(() => first(db, 'SELECT sqrt(16)')),
      },
      { name: 'sqlite-vec', result: run(() => nearestItem(db)) },
    ]
  } finally {
    db.close()
  }
}

function searchNotes(db: NitroSQLiteConnection): string {
  db.execute('DROP TABLE IF EXISTS notes')
  db.execute('CREATE VIRTUAL TABLE notes USING fts5(body)')
  db.execute('INSERT INTO notes (body) VALUES (?), (?)', [
    'SQLite runs inside the app',
    'Expo prebuild writes native settings',
  ])
  return first(db, "SELECT body FROM notes WHERE notes MATCH 'prebuild'")
}

function nearestItem(db: NitroSQLiteConnection): string {
  db.execute('DROP TABLE IF EXISTS items')
  createVectorTable(db, 'items', { dimensions: 2 })
  db.execute('INSERT INTO items (rowid, embedding) VALUES (1, ?), (2, ?)', [
    '[0, 0]',
    '[1, 1]',
  ])
  const [match] = knnSearch(db, 'items', [0.9, 0.8], 1)
  return `${vecVersion(db)}, nearest row ${match?.rowid}`
}

function first(db: NitroSQLiteConnection, sql: string): string {
  return String(db.executeRaw(sql).rows[0]?.[0])
}

function run(check: () => string): string {
  try {
    return check()
  } catch (error) {
    return `failed (${error instanceof Error ? error.message : String(error)})`
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 80, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  row: { fontSize: 16 },
})
