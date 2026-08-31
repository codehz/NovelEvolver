package com.novelevolver.mobilesqlite

import com.facebook.react.bridge.ReactApplicationContext
import java.io.File

class NativeSqliteModule(reactContext: ReactApplicationContext) : NativeSqliteSpec(reactContext) {

  override fun getName() = NAME

  override fun open(name: String, location: String, readonly: Boolean): Double {
    return nativeOpen(resolvePath(name, location), readonly).toDouble()
  }

  override fun execute(connectionId: Double, sql: String, paramsJson: String): String {
    return nativeExecute(connectionId.toInt(), sql, paramsJson)
  }

  override fun close(connectionId: Double) {
    nativeClose(connectionId.toInt())
  }

  private fun resolvePath(name: String, location: String): String {
    if (name == ":memory:") {
      return ":memory:"
    }
    val root = reactApplicationContext.filesDir
    val directory = if (location.isEmpty()) root else File(root, location)
    if (!directory.exists() && !directory.mkdirs() && !directory.isDirectory) {
      throw RuntimeException("Unable to create SQLite directory: ${directory.absolutePath}")
    }
    return File(directory, name).absolutePath
  }

  companion object {
    const val NAME = "NativeSqlite"

    init {
      System.loadLibrary("novelevolver-sqlite")
    }

    @JvmStatic
    private external fun nativeOpen(path: String, readonly: Boolean): Int

    @JvmStatic
    private external fun nativeExecute(connectionId: Int, sql: String, paramsJson: String): String

    @JvmStatic
    private external fun nativeClose(connectionId: Int)
  }
}
