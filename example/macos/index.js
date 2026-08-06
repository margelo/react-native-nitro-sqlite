import '../src/initGlobals.macos'
import { AppRegistry } from 'react-native'
import MacOSApp from '../src/MacOSApp'
import { name as appName } from '../app.json'

AppRegistry.registerComponent(appName, () => MacOSApp)
