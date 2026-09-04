package com.margelo.nitro.mobilefetch

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException

@DoNotStrip
@Keep
class HybridStreamFetchRequest(
  private val client: OkHttpClient,
  private val request: Request,
  private val onResponse: ((info: StreamFetchResponseInfo) -> Unit)?,
  private val onChunk: ((bytes: ArrayBuffer) -> Unit)?,
  private val onComplete: (() -> Unit)?,
  private val onError: ((message: String) -> Unit)?,
) : HybridStreamFetchRequestSpec() {
  @Volatile
  private var call: Call? = null

  override fun start() {
    val next = client.newCall(request)
    call = next
    next.enqueue(
      object : Callback {
        override fun onFailure(call: Call, e: IOException) {
          onError?.invoke(e.message ?: "Request failed")
        }

        override fun onResponse(call: Call, response: Response) {
          response.use { live ->
            if (call.isCanceled()) return
            val headerCount = live.headers.size
            val headers =
              Array(headerCount) { index ->
                StreamFetchHeader(live.headers.name(index), live.headers.value(index))
              }
            onResponse?.invoke(
              StreamFetchResponseInfo(
                live.request.url.toString(),
                live.code.toDouble(),
                live.message,
                headers,
              ),
            )
            val stream = live.body?.byteStream()
            if (stream == null) {
              if (!call.isCanceled()) onComplete?.invoke()
              return
            }
            stream.use { input ->
              val buffer = ByteArray(64 * 1024)
              while (true) {
                if (call.isCanceled()) return
                val read = input.read(buffer)
                if (read < 0) break
                if (read == 0) continue
                onChunk?.invoke(ArrayBuffer.copy(buffer.copyOf(read)))
              }
            }
            if (!call.isCanceled()) onComplete?.invoke()
          }
        }
      },
    )
  }

  override fun cancel() {
    call?.cancel()
  }
}
