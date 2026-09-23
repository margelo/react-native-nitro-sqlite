require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
app_package_json_path = File.expand_path("../package.json", Pod::Config.instance.installation_root)
app_package = File.exist?(app_package_json_path) ? JSON.parse(File.read(app_package_json_path)) : {}
app_config = app_package.fetch("nitroSQLite", {})

unless app_config.is_a?(Hash)
  raise "nitroSQLite in package.json must be an object"
end

if ENV.key?("NITRO_SQLITE_THREADSAFE")
  thread_safe_value = ENV["NITRO_SQLITE_THREADSAFE"]
  unless %w[true false 1 0].include?(thread_safe_value)
    raise "NITRO_SQLITE_THREADSAFE must be true, false, 1, or 0"
  end

  sqlite_threadsafe = %w[true 1].include?(thread_safe_value) ? "1" : "0"
else
  thread_safe_value = app_config.fetch("threadSafe", true)
  unless [true, false].include?(thread_safe_value)
    raise "nitroSQLite.threadSafe in package.json must be true or false"
  end

  sqlite_threadsafe = thread_safe_value ? "1" : "0"
end

if ENV.key?("NITRO_SQLITE_PERFORMANCE_MODE")
  performance_mode_value = ENV["NITRO_SQLITE_PERFORMANCE_MODE"]
  unless %w[true false 1 0].include?(performance_mode_value)
    raise "NITRO_SQLITE_PERFORMANCE_MODE must be true, false, 1, or 0"
  end

  performance_mode = %w[true 1].include?(performance_mode_value)
else
  performance_mode = app_config.fetch("performanceMode", true)

  unless [true, false].include?(performance_mode)
    raise "nitroSQLite.performanceMode in package.json must be true or false"
  end
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

  inherited_cflags = '$(inherited)'
  optimized_cflags = '-DSQLITE_DQS=0 -DSQLITE_DEFAULT_MEMSTATUS=0 -DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1 -DSQLITE_LIKE_DOESNT_MATCH_BLOBS=1 -DSQLITE_MAX_EXPR_DEPTH=0 -DSQLITE_OMIT_DEPRECATED=1 -DSQLITE_OMIT_PROGRESS_CALLBACK=1 -DSQLITE_OMIT_SHARED_CACHE=1 -DSQLITE_USE_ALLOCA=1'

  log_message.call("SQLite thread safety: SQLITE_THREADSAFE=#{sqlite_threadsafe}")
  log_message.call("SQLite performance mode: #{performance_mode ? "enabled" : "disabled"}")
  performance_cflags = performance_mode ? " #{optimized_cflags}" : ""
  other_cflags = "#{inherited_cflags}#{performance_cflags} -DSQLITE_THREADSAFE=#{sqlite_threadsafe} "

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
