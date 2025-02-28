import React from 'react'
import { ScrollView, Text, TouchableOpacity } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { ScreenStyles } from '../styles'
import { useNavigation } from '@react-navigation/native'

export function HomeScreen() {
  const navigation = useNavigation()

  return (
    <ScrollView contentContainerStyle={ScreenStyles.container}>
      <TouchableOpacity onPress={() => navigation.navigate('Unit Tests')}>
        <Text style={ScreenStyles.buttonText}>Unit Tests</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Benchmarks')}>
        <Text style={ScreenStyles.buttonText}>Benchmarks</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </ScrollView>
  )
}
