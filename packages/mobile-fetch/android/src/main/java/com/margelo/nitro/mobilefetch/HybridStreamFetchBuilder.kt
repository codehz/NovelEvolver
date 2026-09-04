package com.margelo.nitro.mobilefetch

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

@DoNotStrip
@Keep
class HybridStreamFetchBuilder(
  private val url: String,
  private val client: OkHttpClient,
) : HybridStreamFetchBuilderSpec() {
  private var method = "GET"
  private val headers = Headers.Builder()
  private var bodyBytes: ByteArray? = null
  private var onResponseCallback: ((info: StreamFetchResponseInfo) -> Unit)? = null
  private var onChunkCallback: ((bytes: ArrayBuffer) -> Unit)? = null
  private var onCompleteCallback: (() -> Unit)? = null
  private var onErrorCallback: ((message: String) -> Unit)? = null

  override fun setMethod(httpMethod: String) {
    this.method = httpMethod.uppercase()
  }

  override fun addHeader(name: String, value: String) {
    headers.add(name, value)
  }

  override fun setBodyString(body: String) {
    bodyBytes = body.toByteArray(Charsets.UTF_8)
  }

  override fun setBodyBytes(body: ArrayBuffer) {
    bodyBytes = body.toByteArray()
  }

  override fun onResponse(callback: (info: StreamFetchResponseInfo) -> Unit) {
    onResponseCallback = callback
  }

  override fun onChunk(callback: (bytes: ArrayBuffer) -> Unit) {
    onChunkCallback = callback
  }

  override fun onComplete(callback: () -> Unit) {
    onCompleteCallback = callback
  }

  override fun onError(callback: (message: String) -> Unit) {
    onErrorCallback = callback
  }

  override fun build(): HybridStreamFetchRequestSpec {
    val requestHeaders = headers.build()
    val body =
      bodyBytes?.let { bytes ->
        val mediaType = requestHeaders["Content-Type"]?.toMediaTypeOrNull()
        bytes.toRequestBody(mediaType)
      }
    val request =
      Request.Builder()
        .url(url)
        .headers(requestHeaders)
        .method(method, if (methodAllowsBody(method)) body ?: ByteArray(0).toRequestBody(null) else null)
        .build()
    return HybridStreamFetchRequest(
      client = client,
      request = request,
      onResponse = onResponseCallback,
      onChunk = onChunkCallback,
      onComplete = onCompleteCallback,
      onError = onErrorCallback,
    )
  }

  private fun methodAllowsBody(method: String): Boolean {
    return method != "GET" && method != "HEAD"
  }
}
