package com.margelo.rnnitrosqlite

import java.util.HashMap;
import java.util.function.Supplier;
import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.margelo.nitro.core.HybridObject;


class RNNitroSQLitePackage : TurboReactPackage() {
    @Nullable
    @Override
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return null
    }

    @Override
    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
        return {
            mapOf()
        }
    }

    companion object {
        init {
            RNNitroSQLiteOnLoad.initializeNative()
        }
    }
}
