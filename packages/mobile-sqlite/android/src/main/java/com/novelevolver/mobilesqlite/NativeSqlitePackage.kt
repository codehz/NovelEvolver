package com.novelevolver.mobilesqlite

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NativeSqlitePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NativeSqliteModule.NAME) NativeSqliteModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      NativeSqliteModule.NAME to ReactModuleInfo(
        NativeSqliteModule.NAME,
        NativeSqliteModule.NAME,
        false,
        false,
        false,
        true,
      ),
    )
  }
}
