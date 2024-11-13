package com.margelo.rnquicksqlite

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class RNQuickSQLitePackage : TurboReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return if (name == RNQuickSQLiteOnLoadModule.NAME) {
          RNQuickSQLiteOnLoadModule(reactContext)
        } else {
          null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return ReactModuleInfoProvider {
          val moduleInfos: MutableMap<String, ReactModuleInfo> = HashMap()
          val isTurboModule: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          moduleInfos[RNQuickSQLiteOnLoadModule.NAME] = ReactModuleInfo(
            RNQuickSQLiteOnLoadModule.NAME,
            RNQuickSQLiteOnLoadModule.NAME,
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
            System.loadLibrary("RNQuickSQLite")
        }
    }
}
