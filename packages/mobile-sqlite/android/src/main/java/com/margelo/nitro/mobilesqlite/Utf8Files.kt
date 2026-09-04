package com.margelo.nitro.mobilesqlite

import android.content.Context
import java.io.File

object Utf8Files {
  const val MIME_TYPE = "application/json"
  const val JSON_SUFFIX = ".json"
  const val MAX_BYTES = 1_000_000
  private const val RELATIVE_DIR = "novelevolver/exports"

  fun exportDirectory(context: Context): File {
    val dir = File(context.cacheDir, RELATIVE_DIR)
    if (!dir.exists() && !dir.mkdirs()) {
      error("无法创建导出目录")
    }
    return dir
  }

  fun validateFileName(fileName: String): String {
    if (
      fileName.isEmpty() ||
      fileName == "." ||
      fileName == ".." ||
      fileName.contains('/') ||
      fileName.contains('\\') ||
      fileName.contains('\u0000')
    ) {
      error("Invalid export file name")
    }
    if (!fileName.endsWith(JSON_SUFFIX, ignoreCase = true)) {
      error("Not a json file")
    }
    return fileName
  }

  fun resolveExport(context: Context, fileName: String): File {
    val name = validateFileName(fileName)
    val dir = exportDirectory(context).canonicalFile
    val file = File(dir, name).canonicalFile
    if (file.parentFile != dir) {
      error("Invalid export file name")
    }
    return file
  }
}
