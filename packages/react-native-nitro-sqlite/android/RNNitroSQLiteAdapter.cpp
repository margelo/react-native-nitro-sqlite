#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include <typeinfo>
#include "HybridNitroSQLite.hpp"
#include "RNNitroSQLiteOnLoad.hpp"

using namespace margelo::nitro::rnnitrosqlite;

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
    return margelo::nitro::rnnitrosqlite::initialize(vm);
}

extern "C"
JNIEXPORT void JNICALL
Java_com_margelo_rnnitrosqlite_DocPathSetter_setDocPathInJNI(JNIEnv *env, jclass clazz,
                                                                         jstring doc_path) {
  const char *nativeString = env->GetStringUTFChars(doc_path, nullptr);
  HybridNitroSQLite::docPath = std::string(nativeString);
  env->ReleaseStringUTFChars(doc_path, nativeString);
}
