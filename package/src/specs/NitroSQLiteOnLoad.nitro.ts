import type { HybridObject } from 'react-native-nitro-modules'

export interface NitroSQLiteOnLoad extends HybridObject<{ android: 'kotlin' }> {
  init(): void
}
