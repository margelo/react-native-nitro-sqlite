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
  ../cpp/hybridObjects
  ../cpp/sqlite
  src/main/cpp
)

# Opt-in: compile the companion's sqlite-vec into this library (shared single sqlite3).
if(NITRO_SQLITE_VEC)
  message(STATUS "[react-native-nitro-sqlite] vector search ENABLED (sqlite-vec from ${NITRO_SQLITE_VEC_CPP_DIR})")
  set(NITRO_SQLITE_VEC_SOURCES
    "${NITRO_SQLITE_VEC_CPP_DIR}/sqlite-vec/sqlite-vec.c"
    "${NITRO_SQLITE_VEC_CPP_DIR}/registerVectorExtensions.cpp"
  )
  target_sources(${CMAKE_PROJECT_NAME} PRIVATE ${NITRO_SQLITE_VEC_SOURCES})
  # SQLITE_CORE: link against our bundled sqlite3; SQLITE_VEC_STATIC: drop Windows dllexport.
  set_source_files_properties(${NITRO_SQLITE_VEC_SOURCES}
    PROPERTIES COMPILE_DEFINITIONS "SQLITE_CORE;SQLITE_VEC_STATIC")
  target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE "${NITRO_SQLITE_VEC_CPP_DIR}")
  target_compile_definitions(${CMAKE_PROJECT_NAME} PRIVATE NITRO_SQLITE_VEC)
endif()

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
  -fexceptions
  -frtti
  -fstack-protector-all
  -O2
  -Wall
  -DONANDROID
)
