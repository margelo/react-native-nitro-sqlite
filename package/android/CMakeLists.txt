cmake_minimum_required(VERSION 3.4.1)
project(RNQuickSQLite)

set (PACKAGE_NAME "RNQuickSQLite")
set (CMAKE_VERBOSE_MAKEFILE ON)
set (CMAKE_CXX_STANDARD 17)
set (BUILD_DIR ${CMAKE_SOURCE_DIR}/build)

add_definitions(
  ${SQLITE_FLAGS}
)

include_directories(
  ../cpp
)

file(GLOB_RECURSE cpp_files RELATIVE ${CMAKE_SOURCE_DIR}
  "../cpp/**.c"
  "../cpp/**.cpp"
  "cpp-adapter.cpp"
)

add_library(${PACKAGE_NAME} SHARED
  ${cpp_files}
)

set_target_properties(
  ${PACKAGE_NAME} PROPERTIES
  CXX_STANDARD 17
  CXX_EXTENSIONS OFF
  POSITION_INDEPENDENT_CODE ON
)

# find_package(ReactAndroid REQUIRED CONFIG)
# find_package(fbjni REQUIRED CONFIG)
find_library(LOG_LIB log)

target_link_libraries(
  ${PACKAGE_NAME}
  ${LOG_LIB}
  android
  fbjni::fbjni
  ReactAndroid::jsi
)

message(WARNING "REACTNATIVE_MERGED_SO: >>>${REACTNATIVE_MERGED_SO}<<<")
if(REACTNATIVE_MERGED_SO)
  message(FATAL_ERROR "REACTNATIVE_MERGED_SO is set")
else()
  message(FATAL_ERROR "REACTNATIVE_MERGED_SO is not set")
endif()

# https://github.com/react-native-community/discussions-and-proposals/discussions/816
# This if-then-else can be removed once this library does not support version below .76
# if (REACTNATIVE_MERGED_SO)
if (ReactAndroid_VERSION_MINOR GREATER_EQUAL 76)
  target_link_libraries(
    ${PACKAGE_NAME}
    ReactAndroid::reactnative
  )
else()
  target_link_libraries(
    ${PACKAGE_NAME}
    ReactAndroid::turbomodulejsijni
    ReactAndroid::react_nativemodule_core
  )
endif()
