import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import App from './App'
import type { MochaTestResult } from '../tests/MochaSetup'
import { runAllTests } from '../tests/runAll'

type MacOSTestReport = {
  error?: string
  results: MochaTestResult[]
}

type MacOSAppProps = {
  macosTestReportUrl?: string
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function postReport(reportUrl: string, report: MacOSTestReport) {
  const response = await fetch(reportUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  })

  if (!response.ok) {
    throw new Error(`Unable to report test results: HTTP ${response.status}`)
  }
}

function MacOSTestApp({ reportUrl }: { reportUrl: string }) {
  const [status, setStatus] = useState('Starting tests…')

  useEffect(() => {
    let cancelled = false

    async function run() {
      let report: MacOSTestReport

      try {
        const results = await runAllTests()
        const failures = results.filter((result) => result.type === 'incorrect')
        report = { results }
        setStatus(
          `${results.length - failures.length} passed, ${failures.length} failed`,
        )
      } catch (error) {
        const errorMessage = toErrorMessage(error)
        report = { error: errorMessage, results: [] }
        setStatus(`Test runner failed: ${errorMessage}`)
      }

      if (cancelled) return

      try {
        await postReport(reportUrl, report)
      } catch (error) {
        console.error('Unable to report macOS test results', error)
        if (!cancelled) {
          setStatus(`Unable to report results: ${toErrorMessage(error)}`)
        }
      }
    }

    run().catch((error) => {
      console.error('Unexpected macOS test runner error', error)
      if (!cancelled) {
        setStatus(`Test runner failed: ${toErrorMessage(error)}`)
      }
    })

    return () => {
      cancelled = true
    }
  }, [reportUrl])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Running macOS tests</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  )
}

export default function MacOSApp({ macosTestReportUrl }: MacOSAppProps) {
  if (macosTestReportUrl != null) {
    return <MacOSTestApp reportUrl={macosTestReportUrl} />
  }

  return <App />
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#111',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  status: {
    color: '#333',
    fontSize: 16,
    textAlign: 'center',
  },
})
