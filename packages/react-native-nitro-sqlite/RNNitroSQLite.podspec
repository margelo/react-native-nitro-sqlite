require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
sqlite_threadsafe = ENV.fetch("NITRO_SQLITE_THREADSAFE", "0")

unless %w[0 1].include?(sqlite_threadsafe)
  raise "NITRO_SQLITE_THREADSAFE must be either 0 or 1"
end
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1'
log_message = lambda do |message|
  puts "\e[34m#{message}\e[0m"
end

Pod::Spec.new do |s|
  s.name         = "RNNitroSQLite"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.platforms    = {
    :ios => min_ios_version_supported,
    :visionos => "1.0",
    :osx => "10.13",
  }
  s.source       = { :git => "https://github.com/margelo/react-native-nitro-sqlite.git", :tag => "#{s.version}" }

  # Opt-in vector search (NITRO_SQLITE_VEC=1); the companion pod compiles the sources.
  nitro_sqlite_vec = ENV['NITRO_SQLITE_VEC'] == '1'
  nitro_sqlite_vec_cpp = File.expand_path(File.join(__dir__, "..", "react-native-nitro-sqlite-vec", "cpp"))

  s.source_files = [
    # Apple platform implementation (Swift)
    "ios/**/*.{swift}",
    # Apple platform autolinking/registration (Objective-C++)
    "ios/**/*.{h,hpp,m,mm}",
    # Implementation (C++ objects)
    "cpp/**/*.{h,hpp,c,cpp}"
  ]

  optimizedCflags = '$(inherited) -DSQLITE_DQS=0 -DSQLITE_DEFAULT_MEMSTATUS=0 -DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1 -DSQLITE_LIKE_DOESNT_MATCH_BLOBS=1 -DSQLITE_MAX_EXPR_DEPTH=0 -DSQLITE_OMIT_DEPRECATED=1 -DSQLITE_OMIT_PROGRESS_CALLBACK=1 -DSQLITE_OMIT_SHARED_CACHE=1 -DSQLITE_USE_ALLOCA=1'

  thread_safety = sqlite_threadsafe == "1" ? "safe" : "unsafe"
  log_message.call("Thread-#{thread_safety} SQLite mode enabled")
  other_cflags = optimizedCflags + " -DSQLITE_THREADSAFE=#{sqlite_threadsafe} "

  s.pod_target_xcconfig = {
    :GCC_PREPROCESSOR_DEFINITIONS => "HAVE_FULLFSYNC=1",
    :WARNING_CFLAGS => "-Wno-shorten-64-to-32 -Wno-comma -Wno-unreachable-code -Wno-conditional-uninitialized -Wno-deprecated-declarations",
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'CLANG_CXX_LIBRARY' => 'libc++',
    'DEFINES_MODULE' => 'YES',
    "HEADER_SEARCH_PATHS" => "\"${PODS_ROOT}/RCT-Folly\"" + (nitro_sqlite_vec ? " \"#{nitro_sqlite_vec_cpp}\"" : ""),
    "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) FOLLY_NO_CONFIG FOLLY_CFG_NO_COROUTINES" + (nitro_sqlite_vec ? " NITRO_SQLITE_VEC=1" : ""),
    "OTHER_CPLUSPLUSFLAGS" => folly_compiler_flags,
    "OTHER_CFLAGS" => other_cflags,
  }

  load 'nitrogen/generated/ios/RNNitroSQLite+autolinking.rb'
  add_nitrogen_files(s)

  install_modules_dependencies(s)

  if ENV['NITRO_SQLITE_USE_PHONE_VERSION'] == '1' then
    s.exclude_files = "cpp/sqlite/sqlite3.c", "cpp/sqlite/sqlite3.h"
    s.library = "sqlite3"
  end
end
