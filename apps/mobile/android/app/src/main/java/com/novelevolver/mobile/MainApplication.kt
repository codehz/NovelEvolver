package com.novelevolver.mobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(NativeSha1Package())
          add(NativeAiExecutionPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    ReactFontManager.getInstance().addCustomFont(this, "MiSans", R.font.misans)
    ReactFontManager.getInstance().addCustomFont(this, "Maple Mono CN", R.font.maple_mono_cn)
    loadReactNative(this)
  }
}
