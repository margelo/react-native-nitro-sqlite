import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text } from 'react-native'
import type { MochaTestResult } from '@tests/MochaSetup'
import { runTests } from '@tests/MochaSetup'
import {
  registerUnitTests,
  registerTypeORMUnitTests,
  registerSqliteVecUnitTests,
} from '@tests/unit'

export function UnitTestScreen() {
  const [results, setResults] = useState<MochaTestResult[]>([])
  const [status, setStatus] = useState('Running tests…')

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
        if (mounted) setStatus('Tests complete')
      })
      .catch((error: unknown) => {
        if (mounted) {
          setStatus(
            `Could not run tests: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  const passed = results.filter((result) => result.type === 'correct').length
  const failed = results.filter((result) => result.type === 'incorrect').length

  return (
    <FlatList
      style={styles.unitTestsScreenContainer}
      contentContainerStyle={styles.contentContainer}
      data={results}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={
        <Text>{`${status} · ${passed} passed · ${failed} failed`}</Text>
      }
      renderItem={({ item }) => {
        if (item.type === 'grouping') return <Text>{item.description}</Text>

        if (item.type === 'incorrect') {
          return (
            <Text>
              🔴 {item.description}: {item.errorMsg}
            </Text>
          )
        }

        return <Text>🟢 {item.description}</Text>
      }}
    />
  )
}

const styles = StyleSheet.create({
  unitTestsScreenContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 50,
  },
})
