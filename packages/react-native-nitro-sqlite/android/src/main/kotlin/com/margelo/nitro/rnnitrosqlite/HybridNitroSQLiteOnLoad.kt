package com.margelo.nitro.rnnitrosqlite

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.rnnitrosqlite.DocPathSetter

@Keep
@DoNotStrip
class HybridNitroSQLiteOnLoad : HybridNitroSQLiteOnLoadSpec() {
  @Keep
  @DoNotStrip
  override fun init() {
    NitroModules.applicationContext?.let { context ->
      DocPathSetter.setDocPath(context)
    }
  }
}
