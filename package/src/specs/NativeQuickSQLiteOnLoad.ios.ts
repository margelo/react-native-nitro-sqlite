import type { Spec as AndroidOnLoadTurboModuleSpec } from './NativeNitroSQLiteOnLoad'

export const noop: AndroidOnLoadTurboModuleSpec = {
  onReactApplicationContextReady: () => undefined,
}

export default noop
