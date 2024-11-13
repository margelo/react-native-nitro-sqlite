import React from 'react'
import { ScrollView, Text, TouchableOpacity } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { ParamList } from '../navigation'
import { StatusBar } from 'expo-status-bar'
import { ScreenStyles } from '../styles'

type Props = NativeStackScreenProps<ParamList, 'NitroSQLite Example'>

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
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
