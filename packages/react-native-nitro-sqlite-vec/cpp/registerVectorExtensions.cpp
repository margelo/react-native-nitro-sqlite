#include "registerVectorExtensions.hpp"

#include <mutex>
#include <sqlite3.h>

#include "sqlite-vec/sqlite-vec.h"

namespace margelo::rnnitrosqlitevec {

void registerVectorExtensions() {
  static std::once_flag onceFlag;
  std::call_once(onceFlag, []() {
    // Statically register sqlite-vec on every sqlite3 connection opened
    // afterwards. No runtime extension loading (sqlite3_load_extension), no
    // separate .so/.dylib — this is what makes us faster than the runtime-load
    // approach used by expo-sqlite.
    sqlite3_auto_extension(reinterpret_cast<void (*)(void)>(sqlite3_vec_init));

    // Future ANN backends register here, e.g.:
    //   sqlite3_auto_extension(reinterpret_cast<void (*)(void)>(sqlite3_usearch_init));
  });
}

} // namespace margelo::rnnitrosqlitevec
