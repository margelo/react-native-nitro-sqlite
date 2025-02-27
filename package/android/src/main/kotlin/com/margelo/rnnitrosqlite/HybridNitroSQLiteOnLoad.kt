package com.margelo.rnnitrosqlite

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.rnnitrosqlite.HybridNitroSQLiteOnLoadSpec
import com.margelo.rnnitrosqlite.DocPathSetter

@Keep
@DoNotStrip
class HybridNitroSQLiteOnLoad : HybridNitroSQLiteOnLoadSpec() {
  @Keep
  @DoNotStrip
  override fun init() {
    if (NitroModules.Companion.applicationContext == null) {
      return
    }

    DocPathSetter.setDocPath(NitroModules.Companion.applicationContext!!)
  }
}
