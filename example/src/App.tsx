import React from 'react'
import 'reflect-metadata'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { RootStack } from './navigation'
import { HomeScreen } from './screens/HomeScreen'
import { UnitTestScreen } from './screens/UnitTestScreen'
import { BenchmarkScreen } from './screens/BenchmarkScreen'

export default function App() {
  return (
    <NavigationContainer>
      <RootStack.Navigator initialRouteName="NitroSQLite Example">
        <RootStack.Screen
          name="NitroSQLite Example"
          component={HomeScreen}
        />
        <RootStack.Screen
          name="Unit Tests"
          component={UnitTestScreen}
        />
        <RootStack.Screen
          name="Benchmarks"
          component={BenchmarkScreen}
        />
      </RootStack.Navigator>

      <StatusBar style="auto" />
    </NavigationContainer>
  )
}
