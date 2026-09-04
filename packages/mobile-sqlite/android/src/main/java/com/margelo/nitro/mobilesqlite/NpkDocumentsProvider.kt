package com.margelo.nitro.mobilesqlite

import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import android.provider.DocumentsContract.Root
import android.provider.DocumentsProvider
import java.io.File
import java.io.FileNotFoundException

class NpkDocumentsProvider : DocumentsProvider() {
  private val rootProjection = arrayOf(
    Root.COLUMN_ROOT_ID,
    Root.COLUMN_DOCUMENT_ID,
    Root.COLUMN_TITLE,
    Root.COLUMN_SUMMARY,
    Root.COLUMN_MIME_TYPES,
    Root.COLUMN_FLAGS,
    Root.COLUMN_ICON,
  )

  private val documentProjection = arrayOf(
    Document.COLUMN_DOCUMENT_ID,
    Document.COLUMN_MIME_TYPE,
    Document.COLUMN_DISPLAY_NAME,
    Document.COLUMN_LAST_MODIFIED,
    Document.COLUMN_FLAGS,
    Document.COLUMN_SIZE,
  )

  override fun onCreate(): Boolean = true

  override fun queryRoots(projection: Array<out String>?): Cursor {
    val context = appContext()
    val result = MatrixCursor(projection ?: rootProjection)
    result.setNotificationUri(
      context.contentResolver,
      DocumentsContract.buildRootsUri(ProjectFiles.documentsAuthority(context)),
    )
    val row = result.newRow()
    row.add(Root.COLUMN_ROOT_ID, "novelevolver")
    row.add(Root.COLUMN_DOCUMENT_ID, ProjectFiles.ROOT_DOCUMENT_ID)
    row.add(Root.COLUMN_TITLE, "NovelEvolver")
    row.add(Root.COLUMN_SUMMARY, "项目文件 (.npk)")
    row.add(Root.COLUMN_MIME_TYPES, ProjectFiles.MIME_TYPE)
    row.add(
      Root.COLUMN_FLAGS,
      Root.FLAG_SUPPORTS_CREATE or Root.FLAG_SUPPORTS_IS_CHILD,
    )
    row.add(Root.COLUMN_ICON, context.applicationInfo.icon)
    return result
  }

  override fun queryDocument(documentId: String, projection: Array<out String>?): Cursor {
    val result = MatrixCursor(projection ?: documentProjection)
    includeDocument(result, fileForDocumentId(documentId), documentId)
    return result
  }

  override fun queryChildDocuments(
    parentDocumentId: String,
    projection: Array<out String>?,
    sortOrder: String?,
  ): Cursor {
    if (parentDocumentId != ProjectFiles.ROOT_DOCUMENT_ID) {
      throw FileNotFoundException("Not a directory: $parentDocumentId")
    }
    val context = appContext()
    val result = MatrixCursor(projection ?: documentProjection)
    result.setNotificationUri(
      context.contentResolver,
      DocumentsContract.buildChildDocumentsUri(
        ProjectFiles.documentsAuthority(context),
        parentDocumentId,
      ),
    )
    ProjectFiles.listNpk(context).forEach { file ->
      includeDocument(result, file, file.name)
    }
    return result
  }

  override fun openDocument(
    documentId: String,
    mode: String,
    signal: CancellationSignal?,
  ): ParcelFileDescriptor {
    val file = fileForDocumentId(documentId)
    if (documentId == ProjectFiles.ROOT_DOCUMENT_ID) {
      throw FileNotFoundException("Cannot open the projects root")
    }
    return ParcelFileDescriptor.open(file, ParcelFileDescriptor.parseMode(mode))
  }

  override fun createDocument(parentDocumentId: String, mimeType: String?, displayName: String): String {
    if (parentDocumentId != ProjectFiles.ROOT_DOCUMENT_ID) {
      throw FileNotFoundException("Cannot create under $parentDocumentId")
    }
    val context = appContext()
    val file = ProjectFiles.uniqueNpkFile(ProjectFiles.directory(context), displayName)
    if (!file.createNewFile()) {
      throw FileNotFoundException("Unable to create ${file.name}")
    }
    ProjectFiles.notifyChanged(context)
    return file.name
  }

  override fun deleteDocument(documentId: String) {
    if (documentId == ProjectFiles.ROOT_DOCUMENT_ID) {
      throw FileNotFoundException("Cannot delete the projects root")
    }
    val context = appContext()
    ProjectFiles.deleteWithSidecars(fileForDocumentId(documentId))
    ProjectFiles.notifyChanged(context)
  }

  override fun renameDocument(documentId: String, displayName: String): String {
    if (documentId == ProjectFiles.ROOT_DOCUMENT_ID) {
      throw FileNotFoundException("Cannot rename the projects root")
    }
    val context = appContext()
    val from = fileForDocumentId(documentId)
    val to = ProjectFiles.uniqueNpkFile(ProjectFiles.directory(context), displayName, from)
    if (from.canonicalFile != to.canonicalFile) {
      ProjectFiles.renameWithSidecars(from, to)
      ProjectFiles.notifyChanged(context)
    }
    return to.name
  }

  override fun isChildDocument(parentDocumentId: String, documentId: String): Boolean {
    return parentDocumentId == ProjectFiles.ROOT_DOCUMENT_ID &&
      documentId != ProjectFiles.ROOT_DOCUMENT_ID &&
      ProjectFiles.isNpkFileName(documentId)
  }

  private fun includeDocument(cursor: MatrixCursor, file: File, documentId: String) {
    val isRoot = documentId == ProjectFiles.ROOT_DOCUMENT_ID
    val row = cursor.newRow()
    row.add(Document.COLUMN_DOCUMENT_ID, documentId)
    row.add(
      Document.COLUMN_MIME_TYPE,
      if (isRoot) Document.MIME_TYPE_DIR else ProjectFiles.MIME_TYPE,
    )
    row.add(Document.COLUMN_DISPLAY_NAME, if (isRoot) "NovelEvolver" else file.name)
    row.add(Document.COLUMN_LAST_MODIFIED, if (file.exists()) file.lastModified() else 0L)
    row.add(
      Document.COLUMN_FLAGS,
      if (isRoot) {
        Document.FLAG_DIR_SUPPORTS_CREATE
      } else {
        Document.FLAG_SUPPORTS_DELETE or
          Document.FLAG_SUPPORTS_RENAME or
          Document.FLAG_SUPPORTS_WRITE
      },
    )
    row.add(Document.COLUMN_SIZE, if (isRoot || !file.exists()) 0L else file.length())
  }

  private fun fileForDocumentId(documentId: String): File {
    val context = appContext()
    try {
      if (documentId == ProjectFiles.ROOT_DOCUMENT_ID) {
        return ProjectFiles.directory(context)
      }
      return ProjectFiles.resolve(context, documentId)
    } catch (error: Throwable) {
      throw FileNotFoundException(error.message)
    }
  }

  private fun appContext(): Context = context ?: throw FileNotFoundException("No context")
}
