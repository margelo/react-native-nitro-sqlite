project(RNQuickSQLite)
cmake_minimum_required(VERSION 3.9.0)

set (PACKAGE_NAME RNQuickSQLite)
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 20)

add_definitions(
  ${SQLITE_FLAGS}
)

file(GLOB_RECURSE cpp_files RELATIVE ${CMAKE_SOURCE_DIR}
  "../cpp/**.c"
  "../cpp/**.cpp"
  "src/main/cpp/cpp-adapter.cpp"
)

# Create library "RNQuickSQLite" and add all C++ files to it
add_library(${PACKAGE_NAME} SHARED
  ${cpp_files}
)

include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/RNQuickSQLite+autolinking.cmake)

# Specifies a path to native header files.
include_directories(
  ../cpp
  ../cpp/specs
  ../cpp/sqlite
  src/main/cpp
)

find_library(LOG_LIB log)

target_link_libraries(
  ${PACKAGE_NAME}
  ${LOG_LIB}
  android
)
