package com.margelo.rnnitrosqlite

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class RNNitroSQLitePackage : TurboReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == RNNitroSQLiteOnLoadModule.NAME) {
          RNNitroSQLiteOnLoadModule(reactContext)
        } else {
          null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
          val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
          val isTurboModule: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          moduleInfos[RNNitroSQLiteOnLoadModule.NAME] = ReactModuleInfo(
            RNNitroSQLiteOnLoadModule.NAME,
            RNNitroSQLiteOnLoadModule.NAME,
            canOverrideExistingModule=false,
            needsEagerInit=true,
            hasConstants=true,
            isCxxModule=false,
            isTurboModule=isTurboModule
          )
          moduleInfos
        }
    }

    companion object {
        init {
            System.loadLibrary("RNNitroSQLite")
        }
    }
}
