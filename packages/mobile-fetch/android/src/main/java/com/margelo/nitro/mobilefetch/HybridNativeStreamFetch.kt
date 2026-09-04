package com.margelo.nitro.mobilefetch

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

@DoNotStrip
@Keep
class HybridNativeStreamFetch : HybridNativeStreamFetchSpec() {
  override fun newBuilder(url: String): HybridStreamFetchBuilderSpec {
    return HybridStreamFetchBuilder(url, sharedClient)
  }

  companion object {
    val sharedClient: OkHttpClient by lazy {
      OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .retryOnConnectionFailure(true)
        .cache(null)
        .build()
    }
  }
}
