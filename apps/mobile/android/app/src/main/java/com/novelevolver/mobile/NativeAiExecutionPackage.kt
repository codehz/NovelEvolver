package com.novelevolver.mobile

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NativeAiExecutionPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == NativeAiExecutionModule.NAME) NativeAiExecutionModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
        NativeAiExecutionModule.NAME to ReactModuleInfo(
            NativeAiExecutionModule.NAME,
            NativeAiExecutionModule.NAME,
            false,
            false,
            false,
            true,
        ),
    )
  }
}
