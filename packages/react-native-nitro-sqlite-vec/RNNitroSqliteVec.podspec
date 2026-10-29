require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

# React Native CLI 20 still requires a podspec to discover iOS dependencies.
# Native sources are built through Package.swift.
Pod::Spec.new do |s|
  s.name         = "RNNitroSqliteVec"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/margelo/react-native-nitro-sqlite"
  s.license      = "MIT"
  s.authors      = "Margelo"
  s.source       = { :git => "https://github.com/margelo/react-native-nitro-sqlite.git", :tag => "#{s.version}" }
  s.platforms    = {
    :ios => "16.0",
    :visionos => "1.0",
    :osx => "10.13",
  }
end
