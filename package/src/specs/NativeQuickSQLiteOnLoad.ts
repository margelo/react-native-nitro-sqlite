import { TurboModuleRegistry, type TurboModule } from 'react-native'

export interface Spec extends TurboModule {
  onReactApplicationContextReady(callback: () => void): void
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNNitroSQLiteOnLoad')
