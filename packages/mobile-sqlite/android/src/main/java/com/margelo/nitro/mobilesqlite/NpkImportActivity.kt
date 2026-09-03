package com.margelo.nitro.mobilesqlite

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import com.margelo.nitro.core.Promise
import java.io.File
import java.io.FileOutputStream
import kotlin.coroutines.Continuation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

class NpkImportActivity : Activity() {
  private var pickerStarted = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    pickerStarted = savedInstanceState?.getBoolean(PICKER_STARTED_KEY) ?: false
    if (!pickerStarted) {
      pickerStarted = true
      try {
        startActivityForResult(
          Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
          },
          PICK_REQUEST_CODE,
        )
      } catch (error: Throwable) {
        complete(Result.failure(error))
        finish()
      }
    }
  }

  override fun onSaveInstanceState(outState: Bundle) {
    outState.putBoolean(PICKER_STARTED_KEY, pickerStarted)
    super.onSaveInstanceState(outState)
  }

  @Deprecated("Deprecated by Android, retained for the package's private picker activity")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != PICK_REQUEST_CODE) return
    val uri = if (resultCode == RESULT_OK) data?.data else null
    if (uri == null) {
      complete(Result.success(""))
      finish()
      return
    }
    Thread {
      val result = runCatching { copyIntoProjects(uri) }
      runOnUiThread {
        finish()
        complete(result)
      }
    }.start()
  }

  private fun copyIntoProjects(uri: Uri): String {
    val resolver = contentResolver
    val displayName =
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getString(0) else null
      } ?: uri.lastPathSegment?.substringAfterLast('/')?.substringAfterLast(':')
      ?: error("无法读取所选文件名")
    if (!ProjectFiles.isNpkFileName(displayName)) {
      error("请选择 .npk 项目文件")
    }

    val directory = ProjectFiles.directory(this)
    val destination = ProjectFiles.uniqueNpkFile(directory, displayName)
    val temporary = File.createTempFile(".npk-import-", ".tmp", directory)
    try {
      val input = resolver.openInputStream(uri) ?: error("无法读取所选文件")
      input.use { source ->
        FileOutputStream(temporary).use { output ->
          source.copyTo(output)
          output.fd.sync()
        }
      }
      if (!temporary.renameTo(destination)) {
        error("无法把项目复制到工作区")
      }
    } finally {
      temporary.delete()
    }
    ProjectFiles.notifyChanged(this)
    return destination.name
  }

  companion object {
    private const val PICK_REQUEST_CODE = 4201
    private const val PICKER_STARTED_KEY = "pickerStarted"
    private val lock = Any()
    private var pending: Continuation<String>? = null

    fun launch(context: Context): Promise<String> {
      return Promise.async {
        suspendCoroutine { continuation ->
          synchronized(lock) {
            if (pending != null) {
              continuation.resumeWithException(IllegalStateException("已有文件导入操作正在进行"))
              return@suspendCoroutine
            }
            pending = continuation
          }
          Handler(Looper.getMainLooper()).post {
            try {
              context.startActivity(
                Intent(context, NpkImportActivity::class.java).apply {
                  addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
              )
            } catch (error: Throwable) {
              complete(Result.failure(error))
            }
          }
        }
      }
    }

    private fun complete(result: Result<String>) {
      val continuation = synchronized(lock) {
        val current = pending
        pending = null
        current
      }
      if (continuation != null) {
        result.fold(continuation::resume, continuation::resumeWithException)
      }
    }
  }
}
