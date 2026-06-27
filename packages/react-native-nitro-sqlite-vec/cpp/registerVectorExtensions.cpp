#include "registerVectorExtensions.hpp"

#include <mutex>
#include <sqlite3.h>

#include "sqlite-vec/sqlite-vec.h"

namespace margelo::rnnitrosqlitevec {

void registerVectorExtensions() {
  static std::once_flag onceFlag;
  std::call_once(onceFlag, []() {
    // Static registration — no runtime load (sqlite3_load_extension), no separate .so/.dylib; faster than expo-sqlite's runtime-load path.
    sqlite3_auto_extension(reinterpret_cast<void (*)(void)>(sqlite3_vec_init));
    // Future ANN backends register here, e.g. sqlite3_auto_extension(...sqlite3_usearch_init).
  });
}

} // namespace margelo::rnnitrosqlitevec
