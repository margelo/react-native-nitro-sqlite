import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text } from 'react-native'
import type { MochaTestResult } from '../tests/MochaSetup'
import { runTests } from '../tests/MochaSetup'
import {
  registerUnitTests,
  /* registerTypeORMUnitTests,  */
} from '../tests/unit'

export function UnitTestScreen() {
  const [results, setResults] = useState<MochaTestResult[]>([])

  useEffect(() => {
    setResults([])
    runTests(
      registerUnitTests,
      // registerTypeORMUnitTests
    ).then(setResults)
  }, [])

  return (
    <FlatList
      style={styles.unitTestsScreenContainer}
      contentContainerStyle={styles.contentContainer}
      data={results}
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
