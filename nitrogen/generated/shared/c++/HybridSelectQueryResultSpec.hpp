///
/// HybridSelectQueryResultSpec.hpp
/// Fri Sep 06 2024
/// This file was generated by nitrogen. DO NOT MODIFY THIS FILE.
/// https://github.com/mrousavy/nitro
/// Copyright © 2024 Marc Rousavy @ Margelo
///

#pragma once

#if __has_include(<NitroModules/HybridObject.hpp>)
#include <NitroModules/HybridObject.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

// Forward declaration of `ColumnMetadata` to properly resolve imports.
namespace margelo::nitro::rnquicksqlite { struct ColumnMetadata; }
// Forward declaration of `ArrayBuffer` to properly resolve imports.
namespace NitroModules { class ArrayBuffer; }

#include <optional>
#include <vector>
#include "ColumnMetadata.hpp"
#include <string>
#include <NitroModules/ArrayBuffer.hpp>

namespace margelo::nitro::rnquicksqlite {

  using namespace margelo::nitro;

  /**
   * An abstract base class for `SelectQueryResult`
   * Inherit this class to create instances of `HybridSelectQueryResultSpec` in C++.
   * @example
   * ```cpp
   * class HybridSelectQueryResult: public HybridSelectQueryResultSpec {
   *   // ...
   * };
   * ```
   */
  class HybridSelectQueryResultSpec: public virtual HybridObject {
    public:
      // Constructor
      explicit HybridSelectQueryResultSpec(): HybridObject(TAG) { }

      // Destructor
      virtual ~HybridSelectQueryResultSpec() { }

    public:
      // Properties
      virtual std::optional<std::vector<ColumnMetadata>> getMetadata() = 0;
      virtual void setMetadata(const std::optional<std::vector<ColumnMetadata>>& metadata) = 0;

    public:
      // Methods
      virtual std::string getString() = 0;
      virtual double getNumber() = 0;
      virtual bool getBoolean() = 0;
      virtual std::shared_ptr<ArrayBuffer> getArrayBuffer() = 0;

    protected:
      // Hybrid Setup
      void loadHybridMethods() override;

    protected:
      // Tag for logging
      static constexpr auto TAG = "SelectQueryResult";
  };

} // namespace margelo::nitro::rnquicksqlite