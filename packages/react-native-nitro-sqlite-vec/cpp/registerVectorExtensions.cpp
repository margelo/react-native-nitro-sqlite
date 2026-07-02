#include "registerVectorExtensions.hpp"

#include <mutex>
#include <sqlite3.h>

#include "sqlite-vec/sqlite-vec.h"

namespace margelo::rnnitrosqlitevec {

void registerVectorExtensions() {
  static std::once_flag onceFlag;
  std::call_once(onceFlag, []() {
    sqlite3_auto_extension(reinterpret_cast<void (*)(void)>(sqlite3_vec_init));
  });
}

} // namespace margelo::rnnitrosqlitevec
