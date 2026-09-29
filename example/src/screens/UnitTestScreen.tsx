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
          <ResultCounts
            passed={passed}
            failed={failed}
          />
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
              <ResultCounts
                passed={item.passed}
                failed={item.failed}
              />
            </Pressable>
          )
        }

        const { result } = item
        return (
          <View
            accessible
            accessibilityLabel={`${result.status}: ${result.title}${result.status === 'failed' ? `: ${result.errorMsg}` : ''}`}
            style={[styles.test, { marginLeft: depth * 16 }]}
          >
            <View style={styles.testContent}>
              <Text
                style={[
                  styles.testIndicator,
                  result.status === 'passed'
                    ? styles.passedIndicator
                    : styles.failedIndicator,
                ]}
              >
                {result.status === 'passed' ? '✓' : '✕'}
              </Text>
              <Text style={styles.testTitle}>{result.title}</Text>
            </View>
            {result.status === 'failed' && (
              <Text style={styles.errorDetails}>{result.errorMsg}</Text>
            )}
          </View>
        )
      }}
    />
  )
}

function ResultCounts({ passed, failed }: { passed: number; failed: number }) {
  return (
    <View style={styles.countRow}>
      <Text style={passed > 0 ? styles.passedCount : styles.mutedCount}>
        {passed} passed
      </Text>
      <Text style={styles.mutedCount}> · </Text>
      <Text style={failed > 0 ? styles.failedCount : styles.mutedCount}>
        {failed} failed
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  header: { marginBottom: 16 },
  status: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  countRow: { flexDirection: 'row' },
  mutedCount: { color: '#666', fontSize: 12 },
  passedCount: { color: '#15803d', fontSize: 12, fontWeight: '600' },
  failedCount: { color: '#b42318', fontSize: 12, fontWeight: '600' },
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
  testContent: { alignItems: 'center', flexDirection: 'row' },
  testIndicator: {
    borderRadius: 10,
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    height: 20,
    lineHeight: 20,
    marginRight: 8,
    overflow: 'hidden',
    textAlign: 'center',
    width: 20,
  },
  passedIndicator: { backgroundColor: '#15803d' },
  failedIndicator: { backgroundColor: '#b42318' },
  testTitle: { flex: 1 },
  error: { color: '#b42318' },
  errorDetails: {
    color: '#b42318',
    fontSize: 12,
    marginLeft: 28,
    marginTop: 3,
  },
})
