package com.margelo.nitro.rnnitrosqlite

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules

/** Android directories for NitroSQLite, read from the application context. */
@Keep
@DoNotStrip
class HybridPlatformContext : HybridPlatformContextSpec() {
  companion object : HybridPlatformContextSpec.Companion {
    override val databaseDirectory: String
      get() = context.filesDir.absolutePath

    override val temporaryDirectory: String?
      get() = context.cacheDir.absolutePath

    override val legacyDatabaseDirectory: String?
      get() = null

    private val context
      get() = NitroModules.applicationContext
        ?: throw IllegalStateException("NitroSQLite needs the React Native application context to find its database directory")
  }
}
