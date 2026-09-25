#!/bin/sh
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
sqlite="$root/packages/react-native-nitro-sqlite/cpp/sqlite"
vec="$root/packages/react-native-nitro-sqlite-vec/cpp"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

cc -O0 -c "$sqlite/sqlite3.c" -o "$tmp/private.o"
cc -O0 -DSQLITE_CORE=1 -DSQLITE_VEC_STATIC=1 -I "$sqlite" -c "$vec/sqlite-vec/sqlite-vec.c" -o "$tmp/vec.o"
c++ -std=c++20 -DSQLITE_CORE=1 -I "$sqlite" -I "$vec" -c "$vec/NitroSQLiteVecRegisterVectorExtensions.cpp" -o "$tmp/vec-register.o"

nm -g "$tmp/private.o" "$tmp/vec.o" "$tmp/vec-register.o" > "$tmp/symbols"
if grep -E '[[:space:]](U|T|D|B|S|R|C) _?sqlite3_' "$tmp/symbols"; then
  echo 'Unprefixed SQLite symbols remain in the bundled objects' >&2
  exit 1
fi
if ! grep -Eq '[[:space:]](T|D|B|S|R|C) _?nitro_sqlite3_version$' "$tmp/symbols"; then
  echo 'The bundled SQLite version data symbol was not prefixed' >&2
  exit 1
fi
if ! grep -Eq '[[:space:]](T|D|B|S|R|C) _?nitro_sqlite3_vec_init$' "$tmp/symbols"; then
  echo 'The vector extension initializer was not prefixed' >&2
  exit 1
fi

cat > "$tmp/private.c" <<'EOF'
#include <sqlite3.h>
#include "sqlite-vec/sqlite-vec.h"

const char *private_version(void) { return sqlite3_libversion(); }
const char *private_sourceid(void) { return sqlite3_sourceid(); }
const char *private_version_data(void) { return sqlite3_version; }
int private_compileoption(const char *option) { return sqlite3_compileoption_used(option); }
int private_vec_available(void) {
  sqlite3 *db = 0;
  sqlite3_stmt *stmt = 0;
  int result = sqlite3_auto_extension((void (*)(void))sqlite3_vec_init);
  if (result != SQLITE_OK || sqlite3_open(":memory:", &db) != SQLITE_OK) return 0;
  result = sqlite3_prepare_v2(db, "SELECT vec_version()", -1, &stmt, 0);
  if (result == SQLITE_OK) result = sqlite3_step(stmt);
  sqlite3_finalize(stmt);
  sqlite3_close(db);
  return result == SQLITE_ROW;
}
EOF

cat > "$tmp/system.c" <<'EOF'
#include <sqlite3.h>

const char *system_version(void) { return sqlite3_libversion(); }
const char *system_sourceid(void) { return sqlite3_sourceid(); }
const char *system_version_data(void) { return sqlite3_version; }
int system_compileoption(const char *option) { return sqlite3_compileoption_used(option); }
int system_vec_available(void) {
  sqlite3 *db = 0;
  sqlite3_stmt *stmt = 0;
  int result = sqlite3_open(":memory:", &db);
  if (result != SQLITE_OK) return 0;
  result = sqlite3_prepare_v2(db, "SELECT vec_version()", -1, &stmt, 0);
  sqlite3_finalize(stmt);
  sqlite3_close(db);
  return result == SQLITE_OK;
}
EOF

cat > "$tmp/main.c" <<'EOF'
#include <assert.h>
#include <stdio.h>
#include <string.h>

const char *private_version(void);
const char *private_sourceid(void);
const char *private_version_data(void);
int private_compileoption(const char *);
int private_vec_available(void);
const char *system_version(void);
const char *system_sourceid(void);
const char *system_version_data(void);
int system_compileoption(const char *);
int system_vec_available(void);

int main(void) {
  assert(strcmp(private_version(), private_version_data()) == 0);
  assert(strcmp(system_version(), system_version_data()) == 0);
  assert(private_version_data() != system_version_data());
  assert(private_compileoption("THREADSAFE=1") == 1);
  assert(private_vec_available());
  assert(!system_vec_available());
  printf("private: %s %s\n", private_version(), private_sourceid());
  printf("system: %s %s\n", system_version(), system_sourceid());
  printf("THREADSAFE=1: private=%d system=%d\n",
         private_compileoption("THREADSAFE=1"), system_compileoption("THREADSAFE=1"));
  return 0;
}
EOF

cc -DSQLITE_CORE=1 -I "$sqlite" -I "$vec" -c "$tmp/private.c" -o "$tmp/private-calls.o"
cc -c "$tmp/system.c" -o "$tmp/system-calls.o"
cc -c "$tmp/main.c" -o "$tmp/main.o"
c++ "$tmp/main.o" "$tmp/private-calls.o" "$tmp/system-calls.o" "$tmp/private.o" "$tmp/vec.o" "$tmp/vec-register.o" -lsqlite3 -lm -ldl -pthread -o "$tmp/coexistence"
"$tmp/coexistence"

# The Apple system-SQLite option must keep its original, unprefixed imports.
c++ -std=c++20 -DSQLITE_CORE=1 -DNITRO_SQLITE_USE_PHONE_VERSION=1 -I "$sqlite" -I "$vec" -c "$vec/NitroSQLiteVecRegisterVectorExtensions.cpp" -o "$tmp/vec-register-system.o"
nm -g "$tmp/vec-register-system.o" > "$tmp/system-symbols"
if ! grep -Eq '[[:space:]]U _?sqlite3_auto_extension$' "$tmp/system-symbols"; then
  echo 'The system-SQLite vector pod did not import system SQLite' >&2
  exit 1
fi
if grep -Eq '[[:space:]]U _?nitro_sqlite3_' "$tmp/system-symbols"; then
  echo 'The system-SQLite vector pod imported private SQLite' >&2
  exit 1
fi
