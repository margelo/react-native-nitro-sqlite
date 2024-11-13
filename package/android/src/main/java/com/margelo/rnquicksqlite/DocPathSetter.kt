package com.margelo.rnquicksqlite

import com.facebook.react.bridge.ReactApplicationContext

object DocPathSetter {
    @JvmStatic
    fun setDocPath(context: ReactApplicationContext) {
        val path = context.filesDir.absolutePath
        setDocPathInJNI(path)
    }

    private external fun setDocPathInJNI(docPath: String)
}
