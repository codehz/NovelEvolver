#include <fbjni/fbjni.h>
#include <jni.h>

#include "NovelEvolverMobileSqliteOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::mobilesqlite::registerAllNatives();
  });
}
