///
/// RNNitroSQLite-Swift-Cxx-Umbrella.hpp
/// This file was generated by nitrogen. DO NOT MODIFY THIS FILE.
/// https://github.com/mrousavy/nitro
/// Copyright © 2024 Marc Rousavy @ Margelo
///

#pragma once

// Forward declarations of C++ defined types
// Forward declaration of `ArrayBuffer` to properly resolve imports.
namespace NitroModules { class ArrayBuffer; }
// Forward declaration of `BatchQueryCommand` to properly resolve imports.
namespace margelo::nitro::rnnitrosqlite { struct BatchQueryCommand; }
// Forward declaration of `BatchQueryResult` to properly resolve imports.
namespace margelo::nitro::rnnitrosqlite { struct BatchQueryResult; }
// Forward declaration of `ColumnType` to properly resolve imports.
namespace margelo::nitro::rnnitrosqlite { enum class ColumnType; }
// Forward declaration of `FileLoadResult` to properly resolve imports.
namespace margelo::nitro::rnnitrosqlite { struct FileLoadResult; }
// Forward declaration of `HybridNativeQueryResultSpec` to properly resolve imports.
namespace margelo::nitro::rnnitrosqlite { class HybridNativeQueryResultSpec; }
// Forward declaration of `HybridNitroSQLiteSpec` to properly resolve imports.
namespace margelo::nitro::rnnitrosqlite { class HybridNitroSQLiteSpec; }
// Forward declaration of `SQLiteQueryColumnMetadata` to properly resolve imports.
namespace margelo::nitro::rnnitrosqlite { struct SQLiteQueryColumnMetadata; }

// Include C++ defined types
#include "BatchQueryCommand.hpp"
#include "BatchQueryResult.hpp"
#include "ColumnType.hpp"
#include "FileLoadResult.hpp"
#include "HybridNativeQueryResultSpec.hpp"
#include "HybridNitroSQLiteSpec.hpp"
#include "SQLiteQueryColumnMetadata.hpp"
#include <NitroModules/ArrayBuffer.hpp>
#include <future>
#include <memory>
#include <optional>
#include <string>
#include <unordered_map>
#include <variant>
#include <vector>

// C++ helpers for Swift
#include "RNNitroSQLite-Swift-Cxx-Bridge.hpp"

// Common C++ types used in Swift
#include <NitroModules/ArrayBufferHolder.hpp>
#include <NitroModules/AnyMapHolder.hpp>
#include <NitroModules/HybridContext.hpp>
#include <NitroModules/PromiseHolder.hpp>

// Forward declarations of Swift defined types
// Forward declaration of `HybridNativeQueryResultSpecCxx` to properly resolve imports.
namespace RNNitroSQLite { class HybridNativeQueryResultSpecCxx; }
// Forward declaration of `HybridNitroSQLiteSpecCxx` to properly resolve imports.
namespace RNNitroSQLite { class HybridNitroSQLiteSpecCxx; }

// Include Swift defined types
#if __has_include("RNNitroSQLite-Swift.h")
// This header is generated by Xcode/Swift on every app build.
// If it cannot be found, make sure the Swift module's name (= podspec name) is actually "RNNitroSQLite".
#include "RNNitroSQLite-Swift.h"
#else
#error RNNitroSQLite's autogenerated Swift header cannot be found! Make sure the Swift module's name (= podspec name) is actually "RNNitroSQLite", and try building the app first.
#endif