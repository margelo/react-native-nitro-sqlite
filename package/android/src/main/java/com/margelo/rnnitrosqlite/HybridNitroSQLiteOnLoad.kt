package com.margelo.rnnitrosqlite

import com.margelo.nitro.NitroModules
import com.margelo.rnnitrosqlite.DocPathSetter

class HybridNitroSQLiteOnLoad : HybridNitroSQLiteOnLoadSpec() {
  override fun init() {
    DocPathSetter.setDocPath(NitroModules.context)
  }
}
