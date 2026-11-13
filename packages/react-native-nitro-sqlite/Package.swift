// swift-tools-version: 6.2

import Foundation
import PackageDescription

let package = Package(
  name: "RNNitroSQLite",
  platforms: [.iOS(.v16)]
)

// SwiftPM caches the evaluated manifest by its contents and environment, not by the package.json it reads.
// After changing nitroSQLite settings, delete ~/Library/Caches/org.swift.swiftpm/manifests and rebuild.
let sqlite = SQLiteBuildOptions.resolve()

addNitrogenTargets(
  to: package,
  // SwiftPM cannot build Objective-C++ in a Swift target, so OnLoad.mm builds with the C++ sources.
  swiftSources: [],
  cxxSources: ["cpp", "ios/OnLoad.mm"],
  cxxSettings: sqlite.defines.map { .define($0.name, to: $0.value) }
)

// addNitrogenTargets only applies C++ settings, but the bundled sqlite3.c is compiled as C.
for target in package.targets where target.name == "RNNitroSQLiteCxx" {
  target.cSettings = sqlite.defines.map { .define($0.name, to: $0.value) } + [
    .disableWarning("shorten-64-to-32"),
    .disableWarning("comma"),
    .disableWarning("unreachable-code"),
    .disableWarning("conditional-uninitialized"),
    .disableWarning("deprecated-declarations"),
  ]
  if sqlite.useSystemSQLite {
    target.exclude.append("cpp/sqlite/sqlite3.c")
    target.linkerSettings = [.linkedLibrary("sqlite3")]
  }
}

/// SQLite compile options from the app's `nitroSQLite` package.json settings and environment overrides.
struct SQLiteBuildOptions {
  var defines: [(name: String, value: String?)]
  var useSystemSQLite: Bool

  static func resolve() -> SQLiteBuildOptions {
    let config = readAppConfig()
    let threadSafe =
      readEnvironmentFlag("NITRO_SQLITE_THREADSAFE") ?? readConfigFlag(config, "threadSafe") ?? true
    let performanceMode =
      readEnvironmentFlag("NITRO_SQLITE_PERFORMANCE_MODE") ?? readConfigFlag(config, "performanceMode") ?? true
    let enableRTree = readConfigFlag(config, "enableRTree") ?? true
    let useSystemSQLite = Context.environment["NITRO_SQLITE_USE_PHONE_VERSION"] == "1"

    var defines: [(name: String, value: String?)] = [("SQLITE_THREADSAFE", threadSafe ? "1" : "0")]
    // SQLite checks whether this macro is defined, so disabling RTree must omit it.
    if enableRTree {
      defines.append(("SQLITE_ENABLE_RTREE", "1"))
    }
    if performanceMode {
      defines += [
        ("SQLITE_DQS", "0"),
        ("SQLITE_DEFAULT_MEMSTATUS", "0"),
        ("SQLITE_DEFAULT_WAL_SYNCHRONOUS", "1"),
        ("SQLITE_LIKE_DOESNT_MATCH_BLOBS", "1"),
        ("SQLITE_MAX_EXPR_DEPTH", "0"),
        ("SQLITE_OMIT_DEPRECATED", "1"),
        ("SQLITE_OMIT_PROGRESS_CALLBACK", "1"),
        ("SQLITE_OMIT_SHARED_CACHE", "1"),
        ("SQLITE_USE_ALLOCA", "1"),
      ]
    }
    if useSystemSQLite {
      defines.append(("NITRO_SQLITE_USE_PHONE_VERSION", "1"))
    }
    // Like nitroSqliteFlags on Android, custom definitions replace defaults with the same name.
    let customDefines = readCustomDefines(config)
    let customNames = Set(customDefines.map(\.name))
    defines.removeAll {
      customNames.contains($0.name) || ($0.name == "SQLITE_THREADSAFE" && customNames.contains("THREADSAFE"))
    }
    return SQLiteBuildOptions(defines: defines + customDefines, useSystemSQLite: useSystemSQLite)
  }
}

/// A JSON value that only distinguishes booleans and strings, so other settings can be rejected.
enum ConfigValue: Decodable {
  case bool(Bool)
  case string(String)
  case other

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    if let value = try? container.decode(Bool.self) {
      self = .bool(value)
    } else if let value = try? container.decode(String.self) {
      self = .string(value)
    } else {
      self = .other
    }
  }
}

struct AppPackage: Decodable {
  var nitroSQLite: [String: ConfigValue]?
}

/// Reads `nitroSQLite` from the nearest package.json above this package, which is the app's.
/// React Native links this package through `<app>/ios/build/generated/autolinking/libs/RNNitroSQLite`.
func readAppConfig() -> [String: ConfigValue] {
  var directory = URL(fileURLWithPath: Context.packageDirectory).deletingLastPathComponent()
  while directory.path != "/" {
    let packageJson = directory.appendingPathComponent("package.json")
    if let data = FileManager.default.contents(atPath: packageJson.path) {
      do {
        return try JSONDecoder().decode(AppPackage.self, from: data).nitroSQLite ?? [:]
      } catch DecodingError.typeMismatch(_, let context) where context.codingPath.count == 1 {
        fatalError("nitroSQLite in package.json must be an object")
      } catch {
        fatalError("Failed to read \(packageJson.path): \(error)")
      }
    }
    directory.deleteLastPathComponent()
  }
  return [:]
}

func readConfigFlag(_ config: [String: ConfigValue], _ name: String) -> Bool? {
  switch config[name] {
  case nil:
    return nil
  case .bool(let value):
    return value
  case .string, .other:
    fatalError("nitroSQLite.\(name) in package.json must be true or false")
  }
}

/// Parses `nitroSQLite.iosSqliteFlags`, a string of `-DNAME` or `-DNAME=VALUE` definitions.
func readCustomDefines(_ config: [String: ConfigValue]) -> [(name: String, value: String?)] {
  let flags: String
  switch config["iosSqliteFlags"] {
  case nil:
    return []
  case .string(let value):
    flags = value
  case .bool, .other:
    fatalError("nitroSQLite.iosSqliteFlags in package.json must be a string")
  }
  return flags.split(whereSeparator: \.isWhitespace).map { flag in
    let definition = flag.dropFirst(2).split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
    guard flag.hasPrefix("-D"), let name = definition.first, name.first?.isNumber == false,
      name.allSatisfy({ $0.isASCII && ($0 == "_" || $0.isLetter || $0.isNumber) })
    else {
      fatalError("nitroSQLite.iosSqliteFlags in package.json must only contain -D definitions, found \(flag)")
    }
    return (String(name), definition.count > 1 ? String(definition[1]) : nil)
  }
}

func readEnvironmentFlag(_ name: String) -> Bool? {
  guard let value = Context.environment[name] else {
    return nil
  }
  switch value {
  case "true", "1":
    return true
  case "false", "0":
    return false
  default:
    fatalError("\(name) must be true, false, 1, or 0")
  }
}

// nitrogen:begin
//
// This section was generated by nitrogen. DO NOT MODIFY THIS SECTION.
// Running nitrogen replaces everything between "nitrogen:begin" and "nitrogen:end".
// https://github.com/margelo/nitro
// Copyright © Marc Rousavy @ Margelo
//

// swift-format-ignore
import Foundation

/// Adds the `RNNitroSQLite` library and its targets to `package`:
///
/// - `RNNitroSQLiteCxx`: The generated cross-platform C++ specs, and your C++ sources.
/// - `RNNitroSQLiteAppleCxx`: The generated C++ bridge declarations that Swift imports.
/// - `RNNitroSQLite`: Your Swift sources and the generated Swift specs.
/// - `RNNitroSQLiteSwiftBridge`: The generated C++ wrappers that call into Swift, and autolinking.
///
/// It also adds the packages these targets depend on: React Native's `ReactNative` package,
/// `NitroModules`, and the Nitro modules whose types the specs use.
/// React Native's autolinking references every library through `build/generated/autolinking/libs/<SwiftName>`,
/// and SwiftPM resolves the relative package paths against that location.
/// List every Nitro module this library depends on in `swiftpmConfig.dependencies` in package.json,
/// so React Native's autolinking links it too.
/// Packages without a C++ language standard use C++20.
///
/// - Parameters:
///   - package: The package to add the library and its targets to.
///   - swiftSources: Directories or files containing your Swift sources, relative to the package root.
///     Paths that don't exist are skipped.
///   - cxxSources: Directories or files containing your C++ sources, relative to the package root.
///     Paths that don't exist are skipped. Their directories are also added to the header search paths.
///   - dependencies: Additional dependencies of all targets.
///   - swiftSettings: Additional Swift settings of the `RNNitroSQLite` Swift target.
///   - cxxSettings: Additional C++ settings of the `RNNitroSQLiteCxx` and `RNNitroSQLiteSwiftBridge` targets.
// swift-format-ignore
func addNitrogenTargets(
    to package: Package,
    swiftSources: [String] = ["ios"],
    cxxSources: [String] = ["cpp"],
    dependencies: [Target.Dependency] = [],
    swiftSettings: [SwiftSetting] = [],
    cxxSettings: [CXXSetting] = []
) {
    package.dependencies += [
        .package(name: "ReactNative", path: "../../../../xcframeworks"),
        .package(name: "NitroModules", path: "../NitroModules"),
    ]
    let nitroModuleDependencies: [Target.Dependency] = [
        .product(name: "NitroModules", package: "NitroModules"),
    ] + dependencies

    let packageDirectory = URL(fileURLWithPath: Context.packageDirectory)
    func exists(_ path: String) -> Bool {
        return FileManager.default.fileExists(atPath: packageDirectory.appendingPathComponent(path).path)
    }
    let userSwiftSources = swiftSources.filter(exists)
    let userCxxSources = cxxSources.filter(exists)
    func userHeaderSearchPaths(relativeTo targetPath: String) -> [CXXSetting] {
        let targetComponents = packageDirectory.appendingPathComponent(targetPath).standardizedFileURL.pathComponents
        return userCxxSources.map { source in
            let sourceURL = packageDirectory.appendingPathComponent(source)
            var isDirectory: ObjCBool = false
            FileManager.default.fileExists(atPath: sourceURL.path, isDirectory: &isDirectory)
            let directory = isDirectory.boolValue ? sourceURL : sourceURL.deletingLastPathComponent()
            let headerComponents = directory.standardizedFileURL.pathComponents
            let commonCount = zip(targetComponents, headerComponents).prefix { $0.0 == $0.1 }.count
            let relativeComponents = Array(repeating: "..", count: targetComponents.count - commonCount)
                + headerComponents.dropFirst(commonCount)
            return .headerSearchPath(relativeComponents.isEmpty ? "." : relativeComponents.joined(separator: "/"))
        }
    }

    // React Native's prebuilt React.framework is either Debug or Release, keep the C++ ABI in sync.
    let releaseSettings: [CXXSetting] = [
        .define("DEBUG", .when(configuration: .debug)),
        .define("NDEBUG", .when(configuration: .release)),
    ]
    let commonCxxSettings: [CXXSetting] = releaseSettings + [
        .disableWarning("nullability-extension"),
    ]
    let reactNativeDependencies: [Target.Dependency] = [
        .product(name: "ReactNativeHeaders", package: "ReactNative"),
        .product(name: "ReactNativeDependenciesHeaders", package: "ReactNative"),
    ]

    let cxxSourcesInTarget = ["nitrogen/generated/shared/c++"] + userCxxSources
    let cxxTarget: Target = .target(
        name: "RNNitroSQLiteCxx",
        dependencies: nitroModuleDependencies + reactNativeDependencies,
        path: ".",
        exclude: nitrogenExcludes(in: ".", keeping: cxxSourcesInTarget)
            + ["nitrogen/generated/shared/c++/include"],
        sources: cxxSourcesInTarget,
        publicHeadersPath: "nitrogen/generated/shared/c++/include",
        cxxSettings: commonCxxSettings + userHeaderSearchPaths(relativeTo: ".") + cxxSettings
    )

    let appleCxxTarget: Target = .target(
        name: "RNNitroSQLiteAppleCxx",
        dependencies: ["RNNitroSQLiteCxx"] + nitroModuleDependencies,
        path: "nitrogen/generated/ios/RNNitroSQLiteAppleCxx",
        cxxSettings: commonCxxSettings + userHeaderSearchPaths(relativeTo: "nitrogen/generated/ios/RNNitroSQLiteAppleCxx")
    )

    let swiftSourcesInTarget = userSwiftSources + [
        "nitrogen/generated/ios/swift",
    ]
    let swiftDependencies: [Target.Dependency] = ["RNNitroSQLiteAppleCxx"] + nitroModuleDependencies
    let generatedSwiftSettings: [SwiftSetting] = [
        .swiftLanguageMode(.v6),
        .enableUpcomingFeature("InternalImportsByDefault"),
        .interoperabilityMode(.Cxx),
        .unsafeFlags(["-Xfrontend", "-clang-header-expose-decls=has-expose-attr-or-stdlib"]),
        // Swift leaves declarations that use another module's Swift types, like AnyJSON,
        // out of the generated header unless that module's header is exposed to it.
        .unsafeFlags([
            "-Xfrontend", "-clang-header-expose-module", "-Xfrontend", "NitroModules=NitroModules-Swift.h",
        ]),
    ]
    let swiftTarget: Target = .target(
        name: "RNNitroSQLite",
        dependencies: swiftDependencies,
        path: ".",
        exclude: nitrogenExcludes(in: ".", keeping: swiftSourcesInTarget),
        sources: swiftSourcesInTarget,
        cxxSettings: releaseSettings,
        swiftSettings: generatedSwiftSettings + swiftSettings
    )

    let swiftBridgeSources = [
        "c++",
        "RNNitroSQLite-Swift-Cxx-Bridge.cpp",
        "RNNitroSQLiteAutolinking.cpp",
        "RNNitroSQLiteAutolinking.mm",
    ].filter { exists("nitrogen/generated/ios/" + $0) }
    let swiftBridgeSettings: [CXXSetting] = [
        // Include Swift's generated header textually after the C++ declarations it uses.
        // Swift Build and Xcode provide the generated header directory.
        .unsafeFlags(["-I${GENERATED_MODULEMAP_DIR}", "-fno-modules"]),
    ]
    let swiftBridgeTarget: Target = .target(
        name: "RNNitroSQLiteSwiftBridge",
        dependencies: [
            "RNNitroSQLite",
            "RNNitroSQLiteAppleCxx",
        ] + nitroModuleDependencies + reactNativeDependencies,
        path: "nitrogen/generated/ios",
        exclude: nitrogenExcludes(in: "nitrogen/generated/ios", keeping: swiftBridgeSources)
            + ["c++/include"],
        sources: swiftBridgeSources,
        publicHeadersPath: "c++/include",
        cxxSettings: commonCxxSettings + userHeaderSearchPaths(relativeTo: "nitrogen/generated/ios") + swiftBridgeSettings + cxxSettings
    )

    package.products.append(
        .library(name: "RNNitroSQLite", targets: ["RNNitroSQLiteCxx", "RNNitroSQLite", "RNNitroSQLiteSwiftBridge"])
    )
    package.targets += [cxxTarget, appleCxxTarget, swiftTarget, swiftBridgeTarget]
    if package.cxxLanguageStandard == nil {
        package.cxxLanguageStandard = .cxx20
    }
}

/// Returns the files and directories in `path` that are neither `sources` nor contain them.
/// Excluding them stops SwiftPM from scanning unrelated files, like `node_modules`.
// swift-format-ignore
func nitrogenExcludes(in path: String, keeping sources: [String]) -> [String] {
    var parents: Set<String> = [""]
    for source in sources {
        var components = source.split(separator: "/").dropLast()
        while !components.isEmpty {
            parents.insert(components.joined(separator: "/"))
            components = components.dropLast()
        }
    }

    let targetURL = URL(fileURLWithPath: Context.packageDirectory).appendingPathComponent(path)
    var excludes: [String] = []
    for parent in parents.sorted() {
        let parentURL = targetURL.appendingPathComponent(parent)
        let entries = (try? FileManager.default.contentsOfDirectory(atPath: parentURL.path)) ?? []
        for entry in entries.sorted() where !entry.hasPrefix(".") {
            let entryPath = parent.isEmpty ? entry : "\(parent)/\(entry)"
            if !sources.contains(entryPath) && !parents.contains(entryPath) {
                excludes.append(entryPath)
            }
        }
    }
    return excludes
}
// nitrogen:end
