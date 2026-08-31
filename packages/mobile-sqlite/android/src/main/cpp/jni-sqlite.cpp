#include <jni.h>

#include <string>

#include "sqlite-engine.hpp"

namespace {

jclass stringClass(JNIEnv* env) {
  return env->FindClass("java/lang/String");
}

jstring utf8Charset(JNIEnv* env) {
  return env->NewStringUTF("UTF-8");
}

jint throwError(JNIEnv* env, const std::string& message) {
  jclass exception = env->FindClass("java/lang/RuntimeException");
  if (exception != nullptr) {
    env->ThrowNew(exception, message.c_str());
  }
  return 0;
}

std::string toUtf8(JNIEnv* env, jstring value) {
  if (value == nullptr) {
    return {};
  }
  jclass clazz = stringClass(env);
  jmethodID getBytes = env->GetMethodID(clazz, "getBytes", "(Ljava/lang/String;)[B");
  jstring charset = utf8Charset(env);
  auto bytes = static_cast<jbyteArray>(env->CallObjectMethod(value, getBytes, charset));
  env->DeleteLocalRef(charset);
  if (bytes == nullptr) {
    return {};
  }
  const jsize size = env->GetArrayLength(bytes);
  std::string copy(static_cast<size_t>(size), '\0');
  env->GetByteArrayRegion(bytes, 0, size, reinterpret_cast<jbyte*>(copy.data()));
  env->DeleteLocalRef(bytes);
  return copy;
}

jstring fromUtf8(JNIEnv* env, const std::string& value) {
  jbyteArray bytes = env->NewByteArray(static_cast<jsize>(value.size()));
  if (bytes == nullptr) {
    return nullptr;
  }
  env->SetByteArrayRegion(
      bytes, 0, static_cast<jsize>(value.size()), reinterpret_cast<const jbyte*>(value.data()));
  jclass clazz = stringClass(env);
  jmethodID ctor = env->GetMethodID(clazz, "<init>", "([BLjava/lang/String;)V");
  jstring charset = utf8Charset(env);
  auto result = static_cast<jstring>(env->NewObject(clazz, ctor, bytes, charset));
  env->DeleteLocalRef(bytes);
  env->DeleteLocalRef(charset);
  return result;
}

} // namespace

extern "C" JNIEXPORT jint JNICALL
Java_com_novelevolver_mobilesqlite_NativeSqliteModule_nativeOpen(
    JNIEnv* env, jclass, jstring path, jboolean readonly) {
  const auto result = ne_sqlite::openDatabase(toUtf8(env, path), readonly == JNI_TRUE);
  if (!result.ok) {
    return throwError(env, result.error);
  }
  return result.connectionId;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_novelevolver_mobilesqlite_NativeSqliteModule_nativeExecute(
    JNIEnv* env, jclass, jint connectionId, jstring sql, jstring paramsJson) {
  const auto result = ne_sqlite::execute(connectionId, toUtf8(env, sql), toUtf8(env, paramsJson));
  if (!result.ok) {
    throwError(env, result.error);
    return nullptr;
  }
  return fromUtf8(env, result.json);
}

extern "C" JNIEXPORT void JNICALL
Java_com_novelevolver_mobilesqlite_NativeSqliteModule_nativeClose(
    JNIEnv*, jclass, jint connectionId) {
  ne_sqlite::closeDatabase(connectionId);
}
