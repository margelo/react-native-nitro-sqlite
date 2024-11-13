package com.margelo.rnquicksqlite

import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.rnquicksqlite.NativeQuickSQLiteOnLoadSpec

class RNQuickSQLiteOnLoadModule(reactContext: ReactApplicationContext) :
    NativeQuickSQLiteOnLoadSpec(reactContext) {
    private var reactApplicationContextReadyCallback: Callback? = null

    init {
        Companion.reactContext = reactContext
        DocPathSetter.setDocPath(reactContext)

        if (reactApplicationContextReadyCallback != null) {
            reactApplicationContextReadyCallback!!.invoke()
        }
    }

    override fun getName(): String {
        return NAME
    }

    override fun onReactApplicationContextReady(callback: Callback) {
        if (reactContext != null) {
            callback.invoke()
            return
        }

        reactApplicationContextReadyCallback = callback
    }

  companion object {
      const val NAME: String = "RNQuickSQLiteOnLoad"

      var reactContext: ReactApplicationContext? = null
        private set
      var reactApplicationContextReadyCallback: Callback? = null
        private set
  }
}
