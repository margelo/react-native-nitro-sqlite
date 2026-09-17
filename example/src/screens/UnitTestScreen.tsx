import React, { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import type { MochaTestResult } from '@tests/MochaSetup'
import { runTests } from '@tests/MochaSetup'
import { getVisibleTestResults } from '@tests/TestResultTree'
import {
  registerUnitTests,
  registerTypeORMUnitTests,
  registerSqliteVecUnitTests,
} from '@tests/unit'

export function UnitTestScreen() {
  const [results, setResults] = useState<MochaTestResult[]>([])
  const [expanded, setExpanded] = useState<ReadonlyMap<string, boolean>>(
    new Map(),
  )
  const [finished, setFinished] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    runTests(
      (result) => {
        if (mounted) setResults((current) => [...current, result])
      },
      registerUnitTests,
      registerTypeORMUnitTests,
      registerSqliteVecUnitTests,
    )
      .then(() => {
        if (mounted) setFinished(true)
      })
      .catch((error: unknown) => {
        if (mounted) {
          setSetupError(error instanceof Error ? error.message : String(error))
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const visibleResults = useMemo(
    () => getVisibleTestResults(results, expanded),
    [results, expanded],
  )
  const passed = results.filter(
    (result) => result.type === 'test' && result.status === 'passed',
  ).length
  const failed = results.filter(
    (result) => result.type === 'test' && result.status === 'failed',
  ).length

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={visibleResults}
      keyExtractor={(item) => item.result.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.status, setupError && styles.error]}>
            {setupError
              ? `Could not run tests: ${setupError}`
              : finished
                ? 'Tests complete'
                : 'Running tests…'}
          </Text>
          <Text style={styles.counts}>
            {passed} passed · {failed} failed
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const { depth } = item

        if ('expanded' in item) {
          const { result } = item
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.expanded ? 'Collapse' : 'Expand'} ${result.title}`}
              accessibilityState={{ expanded: item.expanded }}
              onPress={() => {
                setExpanded((current) => {
                  const next = new Map(current)
                  next.set(result.id, !item.expanded)
                  return next
                })
              }}
              style={[
                styles.suite,
                depth === 0 && styles.file,
                { marginLeft: depth * 16 },
              ]}
            >
              <Text style={depth === 0 ? styles.fileTitle : styles.suiteTitle}>
                {item.expanded ? '▾' : '▸'} {result.title}
              </Text>
              <Text style={styles.counts}>
                {item.passed} passed · {item.failed} failed
              </Text>
            </Pressable>
          )
        }

        const { result } = item
        return (
          <View style={[styles.test, { marginLeft: depth * 16 }]}>
            <Text style={result.status === 'failed' && styles.error}>
              {result.status === 'passed' ? '✓' : '✕'} {result.title}
            </Text>
            {result.status === 'failed' && (
              <Text style={styles.errorDetails}>{result.errorMsg}</Text>
            )}
          </View>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  header: { marginBottom: 16 },
  status: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  counts: { color: '#666', fontSize: 12 },
  suite: {
    borderBottomColor: '#ddd',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  file: { backgroundColor: '#f1f3f5', borderRadius: 8, marginTop: 8 },
  fileTitle: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  suiteTitle: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  test: { paddingHorizontal: 12, paddingVertical: 7 },
  error: { color: '#b42318' },
  errorDetails: { color: '#b42318', fontSize: 12, marginTop: 3 },
})
