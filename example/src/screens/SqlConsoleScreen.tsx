import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import Clipboard from '@react-native-clipboard/clipboard'
import type {
  NitroSQLiteConnection,
  QueryResult,
  SQLiteValue,
} from 'react-native-nitro-sqlite'
import { open } from 'react-native-nitro-sqlite'

const DB_NAME = 'sql-console'

const SAMPLE_QUERIES = [
  'SELECT * FROM users;',
  'SELECT * FROM products ORDER BY price DESC;',
  'SELECT category, COUNT(*) AS count FROM products GROUP BY category;',
  'SELECT category, AVG(price) AS avg_price FROM products GROUP BY category;',
]

type QueryHistoryEntry = {
  query: string
  result?: QueryResult
  error?: string
  durationMs: number
}

function initializeDatabase(db: NitroSQLiteConnection) {
  db.execute('DROP TABLE IF EXISTS products;')
  db.execute('DROP TABLE IF EXISTS users;')

  db.execute(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      age INTEGER
    ) STRICT;
  `)

  db.execute(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL
    ) STRICT;
  `)

  const users: [string, string, number][] = [
    ['Alice Johnson', 'alice@example.com', 28],
    ['Bob Smith', 'bob@example.com', 34],
    ['Carol Williams', 'carol@example.com', 22],
    ['David Brown', 'david@example.com', 41],
  ]

  for (const [name, email, age] of users) {
    db.execute('INSERT INTO users (name, email, age) VALUES (?, ?, ?)', [
      name,
      email,
      age,
    ])
  }

  const products: [string, number, string][] = [
    ['Widget Pro', 29.99, 'Gadgets'],
    ['Super Gizmo', 49.5, 'Gadgets'],
    ['Basic Tool', 9.99, 'Tools'],
    ['Deluxe Kit', 99.0, 'Tools'],
    ['Mystery Box', 15.0, 'Misc'],
  ]

  for (const [name, price, category] of products) {
    db.execute(
      'INSERT INTO products (name, price, category) VALUES (?, ?, ?)',
      [name, price, category],
    )
  }
}

function formatSqliteValue(value: SQLiteValue): unknown {
  if (value instanceof ArrayBuffer) {
    return `[ArrayBuffer ${value.byteLength} bytes]`
  }

  return value
}

function formatQueryResult(result: QueryResult): string {
  const summary: Record<string, unknown> = {
    rowsAffected: result.rowsAffected,
  }

  if (result.insertId != null) {
    summary.insertId = result.insertId
  }

  const rows = result.rows._array.map((row) => {
    const formattedRow: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(row)) {
      formattedRow[key] = formatSqliteValue(value)
    }

    return formattedRow
  })

  if (rows.length > 0) {
    summary.rows = rows
  }

  return JSON.stringify(summary, null, 2)
}

function SelectableOutput({
  value,
  variant = 'output',
}: {
  value: string
  variant?: 'query' | 'output' | 'error'
}) {
  const variantStyle =
    variant === 'query'
      ? styles.resultQuery
      : variant === 'error'
        ? styles.errorText
        : styles.resultText

  return (
    <TextInput
      value={value}
      editable={false}
      multiline
      scrollEnabled={false}
      showSoftInputOnFocus={false}
      underlineColorAndroid="transparent"
      style={[styles.selectableOutput, variantStyle]}
    />
  )
}

function getEntryOutputText(entry: QueryHistoryEntry): string | null {
  if (entry.error != null) {
    return entry.error
  }

  if (entry.result != null) {
    return formatQueryResult(entry.result)
  }

  return null
}

function ResultCard({ entry }: { entry: QueryHistoryEntry }) {
  const hasError = entry.error != null
  const outputText = getEntryOutputText(entry)
  const [didCopy, setDidCopy] = useState(false)

  const copyOutput = useCallback(() => {
    if (outputText == null) {
      return
    }

    Clipboard.setString(outputText)
    setDidCopy(true)

    setTimeout(() => {
      setDidCopy(false)
    }, 1500)
  }, [outputText])

  useEffect(() => {
    setDidCopy(false)
  }, [outputText])

  return (
    <View style={[styles.resultCard, hasError && styles.resultCardError]}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultMeta}>
          {hasError ? 'Failed' : 'Success'} · {entry.durationMs}ms
        </Text>
        {outputText != null && (
          <TouchableOpacity
            style={styles.copyButton}
            onPress={copyOutput}
          >
            <Text style={styles.copyButtonText}>
              {didCopy ? 'Copied' : 'Copy output'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <SelectableOutput
        value={entry.query}
        variant="query"
      />
      {outputText != null && (
        <SelectableOutput
          value={outputText}
          variant={hasError ? 'error' : 'output'}
        />
      )}
    </View>
  )
}

export function SqlConsoleScreen() {
  const dbRef = useRef<NitroSQLiteConnection | null>(null)
  const queryInputRef = useRef<TextInput>(null)
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<QueryHistoryEntry[]>([])
  const [isReady, setIsReady] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    const db = open({ name: DB_NAME })
    dbRef.current = db
    initializeDatabase(db)
    setIsReady(true)

    return () => {
      db.close()
      db.delete()
      dbRef.current = null
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      if (!isReady) {
        return
      }

      const timeout = setTimeout(() => {
        queryInputRef.current?.focus()
      }, 0)

      return () => clearTimeout(timeout)
    }, [isReady]),
  )

  const runQuery = useCallback(() => {
    const db = dbRef.current
    const trimmedQuery = query.trim()

    if (db == null || trimmedQuery.length === 0 || isRunning) {
      return
    }

    setIsRunning(true)
    const start = Date.now()

    try {
      const result = db.execute(trimmedQuery)
      const entry: QueryHistoryEntry = {
        query: trimmedQuery,
        result,
        durationMs: Date.now() - start,
      }
      setHistory((previous) => [entry, ...previous])
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const entry: QueryHistoryEntry = {
        query: trimmedQuery,
        error: errorMessage,
        durationMs: Date.now() - start,
      }
      setHistory((previous) => [entry, ...previous])
    } finally {
      setIsRunning(false)
    }
  }, [query, isRunning])

  const resetDatabase = useCallback(() => {
    const db = dbRef.current

    if (db == null || isRunning) {
      return
    }

    initializeDatabase(db)
    setHistory([])
  }, [isRunning])

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Preparing database…</Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      >
        <Text style={styles.heading}>SQL Console</Text>
        <Text style={styles.description}>
          Database seeded with `users` (4 rows) and `products` (5 rows).
        </Text>

        <Text style={styles.sectionLabel}>Sample queries</Text>
        <View style={styles.sampleQueries}>
          {SAMPLE_QUERIES.map((sampleQuery) => (
            <TouchableOpacity
              key={sampleQuery}
              style={styles.sampleQueryButton}
              onPress={() => setQuery(sampleQuery)}
            >
              <Text style={styles.sampleQueryText}>{sampleQuery}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Query</Text>
        <TextInput
          ref={queryInputRef}
          style={styles.queryInput}
          value={query}
          onChangeText={setQuery}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={SAMPLE_QUERIES[0]}
          textAlignVertical="top"
        />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={runQuery}
            disabled={isRunning}
          >
            {isRunning ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>Run query</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={resetDatabase}
            disabled={isRunning}
          >
            <Text style={styles.secondaryButtonText}>Reset data</Text>
          </TouchableOpacity>
        </View>

        {history.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Results</Text>
            {history.map((entry, index) => (
              <ResultCard
                key={`${entry.query}-${index}`}
                entry={entry}
              />
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    color: 'black',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sampleQueries: {
    gap: 8,
    marginBottom: 20,
  },
  sampleQueryButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
  },
  sampleQueryText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    color: '#111',
  },
  queryInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 14,
    color: 'black',
    backgroundColor: 'white',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
  },
  secondaryButtonText: {
    color: '#111',
    fontWeight: '600',
    fontSize: 16,
  },
  resultCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 12,
  },
  resultCardError: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  copyButton: {
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  copyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  resultQuery: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    color: '#374151',
    marginBottom: 8,
  },
  selectableOutput: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  resultMeta: {
    flex: 1,
    fontSize: 12,
    color: '#6b7280',
  },
  resultText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    color: '#111827',
  },
  errorText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
    color: '#b91c1c',
  },
})
