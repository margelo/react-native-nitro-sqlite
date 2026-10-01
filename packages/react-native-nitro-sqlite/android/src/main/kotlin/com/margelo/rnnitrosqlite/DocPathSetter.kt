package com.margelo.rnnitrosqlite

import com.facebook.react.bridge.ReactApplicationContext

object DocPathSetter {
    @JvmStatic
    fun setDocPath(context: ReactApplicationContext) {
        val path = context.filesDir.absolutePath
        val cachePath = context.cacheDir.absolutePath
        setDocPathInJNI(path, cachePath)
    }

    private external fun setDocPathInJNI(docPath: String, cachePath: String)
}
