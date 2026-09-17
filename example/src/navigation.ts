import { StaticParamList } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { HomeScreen } from './screens/HomeScreen'
import { UnitTestScreen } from './screens/UnitTestScreen'
import { BenchmarkScreen } from './screens/BenchmarkScreen'
import { SqlConsoleScreen } from './screens/SqlConsoleScreen'
import { MigrationTestScreen } from './screens/MigrationTestScreen'

export const RootStack = createNativeStackNavigator({
  screens: {
    'NitroSQLite Example': HomeScreen,
    'Unit Tests': UnitTestScreen,
    'Benchmarks': BenchmarkScreen,
    'SQL Console': SqlConsoleScreen,
    'Database Migration': MigrationTestScreen,
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
