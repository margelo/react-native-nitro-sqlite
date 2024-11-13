import React, { useEffect, useState } from 'react'
import { ScrollView, Text } from 'react-native'
import type { MochaTestResult } from '../tests/MochaSetup'
import { runTests } from '../tests/MochaSetup'
import { registerUnitTests } from '../tests/unitTests.spec'
import { ScreenStyles } from '../styles'

export const UnitTestScreen: React.FC = () => {
  const [results, setResults] = useState<MochaTestResult[]>([])

  useEffect(() => {
    setResults([])
    runTests(
      registerUnitTests
      // registerTypeORMTests
    ).then(setResults)
  }, [])

  return (
    <ScrollView
      contentContainerStyle={[
        ScreenStyles.container,
        // eslint-disable-next-line react-native/no-inline-styles
        { alignItems: 'flex-start' },
      ]}
    >
      {results.map((r, i) => {
        if (r.type === 'grouping') return <Text key={i}>{r.description}</Text>

        if (r.type === 'incorrect') {
          return (
            <Text key={i}>
              🔴 {r.description}: {r.errorMsg}
            </Text>
          )
        }

        return <Text key={i}>🟢 {r.description}</Text>
      })}
    </ScrollView>
  )
}
