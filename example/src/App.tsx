import React from 'react'
import 'reflect-metadata'
import { UnitTestScreen } from './screens/UnitTestScreen'
import { BenchmarkScreen } from './screens/BenchmarkScreen'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import type { ParamList } from './navigation'
import { HomeScreen } from './screens/HomeScreen'

const Stack = createNativeStackNavigator<ParamList>()

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="QuickSQLite Example">
        <Stack.Screen name="QuickSQLite Example" component={HomeScreen} />
        <Stack.Screen name="Unit Tests" component={UnitTestScreen} />
        <Stack.Screen name="Benchmarks" component={BenchmarkScreen} />
      </Stack.Navigator>

      <StatusBar style="auto" />
    </NavigationContainer>
  )
}
