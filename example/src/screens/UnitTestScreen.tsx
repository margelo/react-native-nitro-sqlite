import React, { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import type { MochaTestResult } from '@tests/MochaSetup'
import { runAllTests } from '@tests/runAll'

export function UnitTestScreen() {
  const [results, setResults] = useState<MochaTestResult[]>([])

  useEffect(() => {
    setResults([])
    runAllTests().then(setResults)
  }, [])

  return (
    <FlatList
      style={styles.unitTestsScreenContainer}
      contentContainerStyle={styles.contentContainer}
      data={results}
      renderItem={({ item }) => {
        if (item.type === 'grouping') {
          return <Text style={styles.grouping}>{item.description}</Text>
        }

        const didFail = item.type === 'incorrect'
        const details = didFail
          ? `${item.description}: ${item.errorMsg}`
          : item.description

        return (
          <View style={styles.result}>
            <Text style={styles.status}>{didFail ? '🔴' : '🟢'}</Text>
            <Text style={didFail ? styles.failure : styles.success}>
              {details}
            </Text>
          </View>
        )
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
  grouping: {
    color: '#111',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  result: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    marginBottom: 6,
  },
  status: {
    marginRight: 6,
  },
  success: {
    color: '#111',
    flex: 1,
  },
  failure: {
    color: '#b00020',
    flex: 1,
  },
})
