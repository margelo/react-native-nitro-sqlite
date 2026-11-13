// swift-tools-version: 6.2

import Foundation
import PackageDescription

let useSystemSQLite = Context.environment["NITRO_SQLITE_USE_PHONE_VERSION"] == "1"
let defines: [(name: String, value: String)] =
  [("SQLITE_CORE", "1"), ("SQLITE_VEC_STATIC", "1")] + (useSystemSQLite ? [("NITRO_SQLITE_USE_PHONE_VERSION", "1")] : [])
// sqlite-vec must use the core's sqlite3.h, which renames the bundled SQLite symbols.
let coreSQLiteHeaders = findCoreSQLiteHeaders()

let package = Package(
  name: "RNNitroSqliteVec",
  platforms: [.iOS(.v16)],
  products: [
    .library(name: "RNNitroSqliteVec", targets: ["RNNitroSqliteVec"])
  ],
  targets: [
    .target(
      name: "RNNitroSqliteVec",
      path: "cpp",
      publicHeadersPath: ".",
      cSettings: defines.map { .define($0.name, to: $0.value) } + [
        .unsafeFlags(["-I", coreSQLiteHeaders]),
        .disableWarning("shorten-64-to-32"),
        .disableWarning("comma"),
        .disableWarning("unreachable-code"),
        .disableWarning("conditional-uninitialized"),
      ],
      cxxSettings: defines.map { .define($0.name, to: $0.value) } + [
        .unsafeFlags(["-I", coreSQLiteHeaders])
      ]
    )
  ],
  cxxLanguageStandard: .cxx20
)

/// Finds `cpp/sqlite` of react-native-nitro-sqlite next to this package, either through React Native's
/// `libs/<SwiftName>` alias or in node_modules.
func findCoreSQLiteHeaders() -> String {
  let parent = URL(fileURLWithPath: Context.packageDirectory).deletingLastPathComponent()
  let candidates = ["RNNitroSQLite", "react-native-nitro-sqlite"].map {
    parent.appendingPathComponent($0).appendingPathComponent("cpp/sqlite")
  }
  guard
    let headers = candidates.first(where: {
      FileManager.default.fileExists(atPath: $0.appendingPathComponent("sqlite3.h").path)
    })
  else {
    fatalError("react-native-nitro-sqlite-vec requires react-native-nitro-sqlite. Install it in your app.")
  }
  return headers.path
}
