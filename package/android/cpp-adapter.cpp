#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include <typeinfo>
#include "HybridQuickSQLite.hpp"
#include "RNQuickSQLiteOnLoad.hpp"

using namespace margelo::nitro::rnquicksqlite;

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    return margelo::nitro::rnquicksqlite::initialize(vm);
}

extern "C"
JNIEXPORT void JNICALL
Java_com_margelo_rnquicksqlite_DocPathSetter_setDocPathInJNI(JNIEnv *env, jclass clazz,
                                                                         jstring doc_path) {
  const char *nativeString = env->GetStringUTFChars(doc_path, nullptr);
  HybridQuickSQLite::docPath = std::string(nativeString);
  env->ReleaseStringUTFChars(doc_path, nativeString);
}
