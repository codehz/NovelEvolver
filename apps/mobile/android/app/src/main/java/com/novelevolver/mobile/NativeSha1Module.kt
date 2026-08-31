package com.novelevolver.mobile

import android.util.Base64
import com.facebook.react.bridge.ReactApplicationContext
import java.security.MessageDigest

class NativeSha1Module(reactContext: ReactApplicationContext) : NativeSha1Spec(reactContext) {

  override fun getName() = NAME

  override fun sha1(base64: String): String {
    val digest = MessageDigest.getInstance("SHA-1")
    val bytes = digest.digest(Base64.decode(base64, Base64.NO_WRAP))
    return bytes.joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }
  }

  companion object {
    const val NAME = "NativeSha1"
  }
}
