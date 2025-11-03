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
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
