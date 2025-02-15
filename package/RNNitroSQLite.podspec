require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
folly_compiler_flags = '-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1 -Wno-comma -Wno-shorten-64-to-32'

# TODO: Should be customizable in package.json.
# Used to create comparable benchmark results
performance_mode = 1

Pod::Spec.new do |s|
  s.name         = "RNNitroSQLite"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported, :visionos => "1.0" }
  s.source       = { :git => "https://github.com/margelo/react-native-nitro-sqlite.git", :tag => "#{s.version}" }

  # s.header_mappings_dir = "cpp"
  s.source_files = "ios/**/*.{h,hpp,m,mm}", "cpp/**/*.{h,hpp,c,cpp}"

  s.pod_target_xcconfig = {
    :GCC_PREPROCESSOR_DEFINITIONS => "HAVE_FULLFSYNC=1",
    :WARNING_CFLAGS => "-Wno-shorten-64-to-32 -Wno-comma -Wno-unreachable-code -Wno-conditional-uninitialized -Wno-deprecated-declarations",
    :USE_HEADERMAP => "No",
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
    'CLANG_CXX_LIBRARY' => 'libc++'
  }

  load 'nitrogen/generated/ios/RNNitroSQLite+autolinking.rb'
  add_nitrogen_files(s)

  # Use install_modules_dependencies helper to install the dependencies if React Native version >=0.71.0.
  # See https://github.com/facebook/react-native/blob/febf6b7f33fdb4904669f99d795eba4c0f95d7bf/scripts/cocoapods/new_architecture.rb#L79.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-callinvoker"
    s.dependency "React"
    s.dependency "React-Core"

    # Don't install the dependencies when we run `pod install` in the old architecture.
    if ENV['RCT_NEW_ARCH_ENABLED'] == '1' then
      s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
      s.pod_target_xcconfig    = {
          "HEADER_SEARCH_PATHS" => "\"$(PODS_ROOT)/boost\"",
          "OTHER_CPLUSPLUSFLAGS" => "-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1",
          "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
      }
      s.dependency "React-Codegen"
      s.dependency "RCT-Folly"
      s.dependency "RCTRequired"
      s.dependency "RCTTypeSafety"
      s.dependency "ReactCommon/turbomodule/core"
    end
  end

  optimizedCflags = '$(inherited) -DSQLITE_DQS=0 -DSQLITE_DEFAULT_MEMSTATUS=0 -DSQLITE_DEFAULT_WAL_SYNCHRONOUS=1 -DSQLITE_LIKE_DOESNT_MATCH_BLOBS=1 -DSQLITE_MAX_EXPR_DEPTH=0 -DSQLITE_OMIT_DEPRECATED=1 -DSQLITE_OMIT_PROGRESS_CALLBACK=1 -DSQLITE_OMIT_SHARED_CACHE=1 -DSQLITE_USE_ALLOCA=1'

  if performance_mode == '1' then
    log_message.call("Thread unsafe (1) performance mode enabled. Use only transactions! 🚀🚀")
    xcconfig[:OTHER_CFLAGS] = optimizedCflags + ' -DSQLITE_THREADSAFE=0 '
  end

  if performance_mode == '2' then
    log_message.call("Thread safe (2) performance mode enabled 🚀")
    xcconfig[:OTHER_CFLAGS] = optimizedCflags + ' -DSQLITE_THREADSAFE=1 '
  end

  if ENV['NITRO_SQLITE_USE_PHONE_VERSION'] == '1' then
    s.exclude_files = "cpp/sqlite/sqlite3.c", "cpp/sqlite/sqlite3.h"
    s.library = "sqlite3"
  end
end
