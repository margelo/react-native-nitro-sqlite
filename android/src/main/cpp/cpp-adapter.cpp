#include <jni.h>
#include "RNQuickSQLiteOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::<<androidNamespace>>::initialize(vm);
}