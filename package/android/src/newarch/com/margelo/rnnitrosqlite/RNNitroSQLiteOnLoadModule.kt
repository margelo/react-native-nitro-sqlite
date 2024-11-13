package com.margelo.rnnitrosqlite

import com.facebook.react.bridge.Callback
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.rnnitrosqlite.NativeNitroSQLiteOnLoadSpec

class RNNitroSQLiteOnLoadModule(reactContext: ReactApplicationContext) :
    NativeNitroSQLiteOnLoadSpec(reactContext) {
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
      const val NAME: String = "RNNitroSQLiteOnLoad"

      var reactContext: ReactApplicationContext? = null
        private set
      var reactApplicationContextReadyCallback: Callback? = null
        private set
  }
}
