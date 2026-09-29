#include "HybridNitroSQLite.hpp"
#include "RNNitroSQLiteOnLoad.hpp"
#include <cstdlib>
#include <fbjni/fbjni.h>
#include <jni.h>
#include <jsi/jsi.h>
#include <mutex>
#include <typeinfo>

using namespace margelo::nitro::rnnitrosqlite;

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::rnnitrosqlite::initialize(vm);
}

extern "C" JNIEXPORT void JNICALL Java_com_margelo_rnnitrosqlite_DocPathSetter_setDocPathInJNI(JNIEnv* env, jclass clazz, jstring doc_path,
                                                                                               jstring cache_path) {
  const char* docPath = env->GetStringUTFChars(doc_path, nullptr);
  if (docPath == nullptr) {
    return;
  }

  const char* cachePath = env->GetStringUTFChars(cache_path, nullptr);
  if (cachePath == nullptr) {
    env->ReleaseStringUTFChars(doc_path, docPath);
    return;
  }

  // SQLite caches this environment value during VFS initialization. Do not replace it on JS reload.
  static std::once_flag tempDirectoryOnce;
  static bool tempDirectoryConfigured = false;
  std::call_once(tempDirectoryOnce, [&] { tempDirectoryConfigured = setenv("SQLITE_TMPDIR", cachePath, 1) == 0; });

  if (tempDirectoryConfigured) {
    HybridNitroSQLite::docPath = std::string(docPath);
  } else {
    jclass exception = env->FindClass("java/lang/IllegalStateException");
    if (exception != nullptr) {
      env->ThrowNew(exception, "Could not configure SQLite temporary directory");
    }
  }

  env->ReleaseStringUTFChars(cache_path, cachePath);
  env->ReleaseStringUTFChars(doc_path, docPath);
}
