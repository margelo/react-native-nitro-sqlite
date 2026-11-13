require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# React Native CLI 20 still requires a podspec to discover iOS dependencies.
# Native sources, dependencies, and SQLite build options are in Package.swift.
Pod::Spec.new do |s|
  s.name         = "RNNitroSQLite"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]
  s.source       = { :git => "https://github.com/margelo/react-native-nitro-sqlite.git", :tag => "#{s.version}" }
  s.platforms    = {
    :ios => "16.0",
    :visionos => "1.0",
    :osx => "10.13",
  }
end
