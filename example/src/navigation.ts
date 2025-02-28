import { StaticParamList } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { HomeScreen } from './screens/HomeScreen'
import { UnitTestScreen } from './screens/UnitTestScreen'
import { BenchmarkScreen } from './screens/BenchmarkScreen'

export const RootStack = createNativeStackNavigator({
  screens: {
    'NitroSQLite Example': HomeScreen,
    'Unit Tests': UnitTestScreen,
    'Benchmarks': BenchmarkScreen,
  },
})

type RootStackParamList = StaticParamList<typeof RootStack>

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
