#pragma once

#define NITRO_SQLITE_LOG_TAG "react-native-nitro-sqlite"

#ifdef ANDROID
// LOGS ANDROID
#include <android/log.h>
#define LOGV(...) __android_log_print(ANDROID_LOG_VERBOSE, NITRO_SQLITE_LOG_TAG, __VA_ARGS__)
#define LOGD(...) __android_log_print(ANDROID_LOG_DEBUG, NITRO_SQLITE_LOG_TAG, __VA_ARGS__)
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, NITRO_SQLITE_LOG_TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, NITRO_SQLITE_LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, NITRO_SQLITE_LOG_TAG, __VA_ARGS__)
#define LOGSIMPLE(...)
#else
// LOGS NO ANDROID
#include <stdio.h>
#define LOGV(...)                                                                                                                          \
  printf("  ");                                                                                                                            \
  printf(__VA_ARGS__);                                                                                                                     \
  printf("\t -  <%s> \n", NITRO_SQLITE_LOG_TAG);
#define LOGD(...)                                                                                                                          \
  printf("  ");                                                                                                                            \
  printf(__VA_ARGS__);                                                                                                                     \
  printf("\t -  <%s> \n", NITRO_SQLITE_LOG_TAG);
#define LOGI(...)                                                                                                                          \
  printf("  ");                                                                                                                            \
  printf(__VA_ARGS__);                                                                                                                     \
  printf("\t -  <%s> \n", NITRO_SQLITE_LOG_TAG);
#define LOGW(...)                                                                                                                          \
  printf("  * Warning: ");                                                                                                                 \
  printf(__VA_ARGS__);                                                                                                                     \
  printf("\t -  <%s> \n", NITRO_SQLITE_LOG_TAG);
#define LOGE(...)                                                                                                                          \
  printf("  *** Error:  ");                                                                                                                \
  printf(__VA_ARGS__);                                                                                                                     \
  printf("\t -  <%s> \n", NITRO_SQLITE_LOG_TAG);
#define LOGSIMPLE(...)                                                                                                                     \
  printf(" ");                                                                                                                             \
  printf(__VA_ARGS__);
#endif // ANDROID
