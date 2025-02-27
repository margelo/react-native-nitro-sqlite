package com.margelo.rnnitrosqlite

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.margelo.nitro.rnnitrosqlite.RNNitroSQLiteOnLoad


class RNNitroSQLitePackage : TurboReactPackage() {
    @Override
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return null
    }

    @Override
    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
      return ReactModuleInfoProvider { HashMap() }
    }

    companion object {
        init {
            RNNitroSQLiteOnLoad.initializeNative()
        }
    }
}
