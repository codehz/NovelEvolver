package com.novelevolver.mobile

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NativeSha1Package : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NativeSha1Module.NAME) NativeSha1Module(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      NativeSha1Module.NAME to ReactModuleInfo(
        NativeSha1Module.NAME,
        NativeSha1Module.NAME,
        false,
        false,
        false,
        true,
      ),
    )
  }
}
