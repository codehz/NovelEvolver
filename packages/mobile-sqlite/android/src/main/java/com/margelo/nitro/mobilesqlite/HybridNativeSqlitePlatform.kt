package com.margelo.nitro.mobilesqlite

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules

@DoNotStrip
@Keep
class HybridNativeSqlitePlatform : HybridNativeSqlitePlatformSpec() {
  override fun getBaseDirectory(): String {
    val context = NitroModules.applicationContext
      ?: throw Error("Cannot get SQLite base directory — no Android Context available")
    return context.filesDir.absolutePath
  }
}
