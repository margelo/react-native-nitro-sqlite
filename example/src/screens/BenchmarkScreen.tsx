import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { benchmarkCases } from '../benchmarks/cases'
import {
  runBenchmarkCases,
  type BenchmarkReport,
  type BenchmarkResult,
  type BenchmarkSample,
} from '../benchmarks/runner'

export function BenchmarkScreen() {
  const [buildLabel, setBuildLabel] = useState('')
  const [results, setResults] = useState<BenchmarkResult[]>([])
  const [report, setReport] = useState<BenchmarkReport>()
  const [status, setStatus] = useState('Ready')
  const [isRunning, setIsRunning] = useState(false)

  const startBenchmarks = useCallback(async () => {
    setResults([])
    setReport(undefined)
    setStatus('Reading SQLite settings')
    setIsRunning(true)

    try {
      const nextReport = await runBenchmarkCases(
        benchmarkCases,
        buildLabel.trim(),
        (label, result) => {
          if (result == null) {
            setStatus(`Running ${label}`)
            return
          }
          setResults((previous) => [...previous, result])
        },
      )
      setReport(nextReport)
      setStatus(
        nextReport.results.some((result) => result.status === 'failed')
          ? 'Finished with failures'
          : 'Finished',
      )
    } catch (error) {
      setStatus(
        `Could not start: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setIsRunning(false)
    }
  }, [buildLabel])

  const shareReport = useCallback(async () => {
    if (report == null) return
    await Share.share({ message: JSON.stringify(report, null, 2) })
  }, [report])

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>NitroSQLite benchmarks</Text>
      <Text style={styles.explanation}>
        One warmup precedes each case. Timed work excludes database setup and
        result checks. Run a Release build on a physical device for comparisons.
      </Text>
      <TextInput
        accessibilityLabel="Build or commit label"
        editable={!isRunning}
        onChangeText={setBuildLabel}
        placeholder="Build or commit label (optional)"
        style={styles.input}
        value={buildLabel}
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={isRunning}
          onPress={startBenchmarks}
          style={[styles.button, isRunning && styles.disabled]}
        >
          <Text style={styles.buttonText}>Run suite</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={report == null || isRunning}
          onPress={shareReport}
          style={[
            styles.button,
            (report == null || isRunning) && styles.disabled,
          ]}
        >
          <Text style={styles.buttonText}>Share results</Text>
        </Pressable>
      </View>
      <View style={styles.statusRow}>
        {isRunning && <ActivityIndicator color="#555" />}
        <Text style={styles.status}>{status}</Text>
      </View>
      {results.map((result) => (
        <BenchmarkResultView
          key={result.id}
          result={result}
        />
      ))}
      {report != null && (
        <Text style={styles.note}>
          {report.environment.platform} {report.environment.osVersion} ·{' '}
          {report.environment.deviceModel} · SQLite{' '}
          {report.environment.sqliteVersion} ·{' '}
          {report.environment.developmentBuild ? 'Development' : 'Release'}
        </Text>
      )}
    </ScrollView>
  )
}

function BenchmarkResultView({ result }: { result: BenchmarkResult }) {
  if (result.status === 'failed') {
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>{result.label}</Text>
        <Text style={styles.error}>Failed: {result.error}</Text>
      </View>
    )
  }

  const extraMetrics = Object.keys(result.samples[0]?.metrics ?? {})

  return (
    <View style={styles.result}>
      <Text style={styles.resultTitle}>{result.label}</Text>
      <Text>
        Median {result.medianMs.toFixed(1)} ms · range {result.minMs.toFixed(1)}
        –{result.maxMs.toFixed(1)} ms
      </Text>
      <Text style={styles.detail}>
        Samples:{' '}
        {result.samples.map((sample) => sample.elapsedMs.toFixed(1)).join(', ')}
        {' ms'}
      </Text>
      <Text style={styles.detail}>
        JS timer delay (separate run):{' '}
        {result.jsTimerDelayMs == null
          ? 'not sampled'
          : `${result.jsTimerDelayMs.toFixed(1)} ms`}
      </Text>
      <Text style={styles.detail}>
        {result.memory.status === 'measured'
          ? `Sampled process peak: +${(result.memory.increaseBytes / 1048576).toFixed(1)} MiB (${result.memory.metric}, ${result.memory.intervalMs} ms interval; separate run)`
          : `Process memory: ${result.memory.reason}`}
      </Text>
      {extraMetrics.map((key) => (
        <Text
          key={key}
          style={styles.detail}
        >
          {key}: {medianMetric(result.samples, key).toFixed(1)} ms median
        </Text>
      ))}
    </View>
  )
}

function medianMetric(samples: BenchmarkSample[], key: string): number {
  const values = samples
    .map((sample) => sample.metrics?.[key])
    .filter((value): value is number => value != null)
    .sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)] ?? 0
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  title: { color: '#111', fontSize: 22, fontWeight: '700' },
  explanation: { color: '#444', lineHeight: 20 },
  input: {
    borderColor: '#aaa',
    borderRadius: 6,
    borderWidth: 1,
    color: '#111',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actions: { flexDirection: 'row', gap: 12 },
  button: {
    backgroundColor: '#1769aa',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  status: { color: '#333', flexShrink: 1 },
  result: {
    borderColor: '#ddd',
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  resultTitle: { color: '#111', fontWeight: '700' },
  detail: { color: '#555', fontSize: 12 },
  error: { color: '#b00020' },
  note: { color: '#555', fontSize: 12 },
})
