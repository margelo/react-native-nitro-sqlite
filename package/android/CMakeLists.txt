cmake_minimum_required(VERSION 3.13)
project(RNNitroSQLite)

set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

add_definitions(
  ${SQLITE_FLAGS}
)

file(GLOB_RECURSE cpp_files RELATIVE ${CMAKE_SOURCE_DIR}
  "../cpp/**.c"
  "../cpp/**.cpp"
  "cpp-adapter.cpp"
)

# Create library "RNNitroSQLite" and add all C++ files to it
add_library(${CMAKE_PROJECT_NAME} SHARED
  ${cpp_files}
)

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/RNNitroSQLite+autolinking.cmake)

# Specifies a path to native header files.
include_directories(
  ../cpp
  ../cpp/specs
  ../cpp/sqlite
  src/main/cpp
)

set_target_properties(
  ${CMAKE_PROJECT_NAME} PROPERTIES
  CXX_STANDARD ${CMAKE_CXX_STANDARD}
  CXX_EXTENSIONS OFF
  POSITION_INDEPENDENT_CODE ON
)

find_package(ReactAndroid REQUIRED CONFIG)
find_package(fbjni REQUIRED CONFIG)
find_library(LOG_LIB log)

target_link_libraries(
  ${CMAKE_PROJECT_NAME}
  ${LOG_LIB}
  android
  fbjni::fbjni
  ReactAndroid::jsi
)

# https://github.com/react-native-community/discussions-and-proposals/discussions/816
# This if-then-else can be removed once this library does not support version below .76
if (REACTNATIVE_MERGED_SO OR ReactAndroid_VERSION_MINOR GREATER_EQUAL 76)
  target_link_libraries(
    ${CMAKE_PROJECT_NAME}
    ReactAndroid::reactnative
  )
else()
  target_link_libraries(
    ${CMAKE_PROJECT_NAME}
    ReactAndroid::turbomodulejsijni
    ReactAndroid::react_nativemodule_core
  )
endif()

target_compile_options(
  ${CMAKE_PROJECT_NAME}
  PRIVATE
  -DLOG_TAG=\"ReactNative\"
  -fexceptions
  -frtti
  -fstack-protector-all
  -O2
  -Wall
  -DONANDROID
)
