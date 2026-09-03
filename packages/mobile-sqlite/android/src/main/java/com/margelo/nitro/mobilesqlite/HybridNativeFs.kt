package com.margelo.nitro.mobilesqlite

import android.content.ClipData
import android.content.Intent
import androidx.annotation.Keep
import androidx.core.content.FileProvider
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise

@DoNotStrip
@Keep
class HybridNativeFs : HybridNativeFsSpec() {
  override fun listNpkFiles(): Array<String> {
    return ProjectFiles.listNpk(requireContext()).map { it.name }.toTypedArray()
  }

  override fun fileExists(fileName: String): Boolean {
    return ProjectFiles.resolve(requireContext(), fileName).exists()
  }

  override fun deleteFile(fileName: String) {
    val context = requireContext()
    ProjectFiles.deleteWithSidecars(ProjectFiles.resolve(context, fileName))
    ProjectFiles.notifyChanged(context)
  }

  override fun renameFile(fromFileName: String, toFileName: String) {
    val context = requireContext()
    ProjectFiles.renameWithSidecars(
      ProjectFiles.resolve(context, fromFileName),
      ProjectFiles.resolve(context, toFileName),
    )
    ProjectFiles.notifyChanged(context)
  }

  override fun importNpkFile(): Promise<String> {
    return NpkImportActivity.launch(requireContext())
  }

  override fun shareFile(fileName: String) {
    val context = requireContext()
    val file = ProjectFiles.resolve(context, fileName)
    if (!file.exists()) {
      error("项目文件不存在")
    }
    val uri = FileProvider.getUriForFile(context, ProjectFiles.fileProviderAuthority(context), file)
    val send = Intent(Intent.ACTION_SEND).apply {
      type = ProjectFiles.MIME_TYPE
      putExtra(Intent.EXTRA_STREAM, uri)
      putExtra(Intent.EXTRA_TITLE, fileName)
      clipData = ClipData.newRawUri(fileName, uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    val chooser = Intent.createChooser(send, fileName).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(chooser)
  }

  override fun notifyChanged() {
    ProjectFiles.notifyChanged(requireContext())
  }

  private fun requireContext() =
    NitroModules.applicationContext
      ?: throw Error("Cannot access project files — no Android Context available")
}
