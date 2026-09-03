package com.margelo.nitro.mobilesqlite

import android.content.Context
import android.provider.DocumentsContract
import java.io.File

object ProjectFiles {
  const val RELATIVE_DIR = "novelevolver/projects"
  const val ROOT_DOCUMENT_ID = "root"
  const val MIME_TYPE = "application/octet-stream"
  const val NPK_SUFFIX = ".npk"

  private val sidecarSuffixes = arrayOf("-journal", "-wal", "-shm")

  fun documentsAuthority(context: Context): String = "${context.packageName}.documents"

  fun fileProviderAuthority(context: Context): String = "${context.packageName}.npkfile"

  fun directory(context: Context): File {
    val dir = File(context.filesDir, RELATIVE_DIR)
    if (!dir.exists() && !dir.mkdirs()) {
      error("Unable to create projects directory")
    }
    return dir
  }

  fun isNpkFileName(name: String): Boolean = name.endsWith(NPK_SUFFIX, ignoreCase = true)

  fun validateFileName(fileName: String): String {
    if (
      fileName.isEmpty() ||
      fileName == "." ||
      fileName == ".." ||
      fileName.contains('/') ||
      fileName.contains('\\') ||
      fileName.contains('\u0000')
    ) {
      error("Invalid project file name")
    }
    if (!isNpkFileName(fileName)) {
      error("Not an npk file")
    }
    return fileName
  }

  fun resolve(context: Context, fileName: String): File {
    val name = validateFileName(fileName)
    val dir = directory(context).canonicalFile
    val file = File(dir, name).canonicalFile
    if (file.parentFile != dir) {
      error("Invalid project file name")
    }
    return file
  }

  fun listNpk(context: Context): List<File> {
    val files = directory(context).listFiles() ?: return emptyList()
    return files.filter { it.isFile && isNpkFileName(it.name) }.sortedBy { it.name }
  }

  fun deleteWithSidecars(file: File) {
    sidecarSuffixes.forEach { suffix -> File(file.path + suffix).delete() }
    if (file.exists() && !file.delete()) {
      error("Unable to delete ${file.name}")
    }
  }

  fun renameWithSidecars(from: File, to: File) {
    if (to.exists()) {
      error("目标文件已存在")
    }
    if (!from.renameTo(to)) {
      error("无法重命名 ${from.name}")
    }
    sidecarSuffixes.forEach { suffix ->
      val sidecar = File(from.path + suffix)
      if (sidecar.exists()) {
        sidecar.renameTo(File(to.path + suffix))
      }
    }
  }

  fun uniqueNpkFile(directory: File, displayName: String, ignore: File? = null): File {
    var stem = displayName.trim()
    if (stem.endsWith(NPK_SUFFIX, ignoreCase = true)) {
      stem = stem.dropLast(NPK_SUFFIX.length)
    }
    stem = stem.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_").trim()
    if (stem.isEmpty() || stem == "." || stem == "..") {
      stem = "project"
    }
    var candidate = File(directory, "$stem$NPK_SUFFIX")
    var index = 1
    val ignored = ignore?.canonicalFile
    while (candidate.exists() && candidate.canonicalFile != ignored) {
      candidate = File(directory, "$stem ($index)$NPK_SUFFIX")
      index += 1
    }
    return candidate
  }

  fun notifyChanged(context: Context) {
    val authority = documentsAuthority(context)
    context.contentResolver.notifyChange(DocumentsContract.buildRootsUri(authority), null, 0)
    context.contentResolver.notifyChange(
      DocumentsContract.buildChildDocumentsUri(authority, ROOT_DOCUMENT_ID),
      null,
      0,
    )
  }
}
