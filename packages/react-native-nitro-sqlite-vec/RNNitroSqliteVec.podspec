require "json"
# Older core versions support the environment switches but do not include the Expo reader.
config_reader = File.expand_path("../react-native-nitro-sqlite/ios/sqlite-config.rb", __dir__)
if File.exist?(config_reader)
  require config_reader
  pod_properties = NitroSQLitePodConfig.read(Pod::Config.instance.installation_root)
  system_sqlite = NitroSQLitePodConfig.enabled(pod_properties, "nitroSqlite.useSystemSqlite", "NITRO_SQLITE_USE_PHONE_VERSION")
  nitro_sqlite_vec = NitroSQLitePodConfig.enabled(pod_properties, "nitroSqlite.vec", "NITRO_SQLITE_VEC")
else
  system_sqlite = ENV['NITRO_SQLITE_USE_PHONE_VERSION'] == '1'
  nitro_sqlite_vec = ENV['NITRO_SQLITE_VEC'] == '1'
end

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# Apple-platform opt-in (NITRO_SQLITE_VEC=1); compile sqlite-vec and static-link into the core's sqlite3.

# The core's bundled sqlite3.h (compiled with SQLITE_CORE to link it directly).
core_sqlite_headers = File.expand_path(File.join(__dir__, "..", "react-native-nitro-sqlite", "cpp", "sqlite"))

Pod::Spec.new do |s|
  s.name         = "RNNitroSqliteVec"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/margelo/react-native-nitro-sqlite"
  s.license      = "MIT"
  s.authors      = "Margelo"
  s.platforms    = {
    :ios => min_ios_version_supported,
    :visionos => "1.0",
    :osx => "10.13",
  }
  s.source       = { :git => "https://github.com/margelo/react-native-nitro-sqlite.git", :tag => "#{s.version}" }

  if nitro_sqlite_vec
    s.source_files = "cpp/**/*.{c,cpp,h,hpp}"
    s.pod_target_xcconfig = {
      "GCC_PREPROCESSOR_DEFINITIONS" => "$(inherited) SQLITE_CORE=1 SQLITE_VEC_STATIC=1" + (system_sqlite ? " NITRO_SQLITE_USE_PHONE_VERSION=1" : ""),
      "USER_HEADER_SEARCH_PATHS" => "\"#{core_sqlite_headers}\"",
      "HEADER_SEARCH_PATHS" => "\"#{core_sqlite_headers}\"",
      "WARNING_CFLAGS" => "-Wno-shorten-64-to-32 -Wno-comma -Wno-unreachable-code -Wno-conditional-uninitialized",
    }
    s.dependency "RNNitroSQLite"
  else
    # Disabled: ship headers only, compile nothing.
    s.source_files = "cpp/**/*.{h,hpp}"
  end
end
