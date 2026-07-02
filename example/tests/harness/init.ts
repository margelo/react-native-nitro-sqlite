import '@/initGlobals'
import * as harnessTestApi from 'react-native-harness'
import { setTestApi } from '@tests/TestApi'

function init() {
  setTestApi(harnessTestApi)
}

export default init
