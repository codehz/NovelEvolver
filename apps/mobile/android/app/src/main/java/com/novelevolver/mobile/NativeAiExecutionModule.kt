package com.novelevolver.mobile

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NativeAiExecutionModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  @ReactMethod
  fun start() {
    AiExecutionService.start(reactApplicationContext)
  }

  @ReactMethod
  fun stop() {
    AiExecutionService.stop(reactApplicationContext)
  }

  companion object {
    const val NAME = "NativeAiExecution"
  }
}
