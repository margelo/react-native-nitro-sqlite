#!/usr/bin/env bash
set -euo pipefail

python3 scripts/generate-sqlite-symbol-prefix.py --check
sh scripts/test-private-sqlite-symbols.sh

clang \
  -std=c11 \
  -DSQLITE_THREADSAFE=2 \
  -c packages/react-native-nitro-sqlite/cpp/sqlite/sqlite3.c \
  -o /tmp/sqlite3.o

clang++ \
  -std=c++20 \
  -Wall \
  -Wextra \
  -Werror \
  -Ipackages/react-native-nitro-sqlite/cpp \
  -Ipackages/react-native-nitro-sqlite/cpp/sqlite \
  packages/react-native-nitro-sqlite/cpp/NitroSQLiteDatabaseMigration.cpp \
  packages/react-native-nitro-sqlite/tests/cpp/databaseMigration.test.cpp \
  /tmp/sqlite3.o \
  -ldl \
  -lm \
  -pthread \
  -o /tmp/databaseMigrationTests

/tmp/databaseMigrationTests

clang++ \
  -std=c++20 \
  -Wall \
  -Wextra \
  -Werror \
  -Ipackages/react-native-nitro-sqlite/cpp \
  -Ipackages/react-native-nitro-sqlite/cpp/sqlite \
  packages/react-native-nitro-sqlite/cpp/NitroSQLiteDatabaseConnections.cpp \
  packages/react-native-nitro-sqlite/cpp/NitroSQLiteDatabaseMigration.cpp \
  packages/react-native-nitro-sqlite/tests/cpp/databaseConnections.test.cpp \
  /tmp/sqlite3.o \
  -ldl \
  -lm \
  -pthread \
  -o /tmp/databaseConnectionsTests

/tmp/databaseConnectionsTests

clang++ \
  -std=c++20 \
  -Wall \
  -Wextra \
  -Werror \
  -Ipackages/react-native-nitro-sqlite/cpp \
  -Ipackages/react-native-nitro-sqlite/cpp/sqlite \
  packages/react-native-nitro-sqlite/tests/cpp/statementGroup.test.cpp \
  /tmp/sqlite3.o \
  -ldl \
  -lm \
  -pthread \
  -o /tmp/statementGroupTests
/tmp/statementGroupTests

clang++ \
  -std=c++20 \
  -Wall \
  -Wextra \
  -Werror \
  -Ipackages/react-native-nitro-sqlite/cpp \
  -Ipackages/react-native-nitro-sqlite/cpp/sqlite \
  packages/react-native-nitro-sqlite/tests/cpp/statementCache.test.cpp \
  /tmp/sqlite3.o \
  -ldl \
  -lm \
  -pthread \
  -o /tmp/statementCacheTests
/tmp/statementCacheTests

clang++ \
  -std=c++20 \
  -Wall \
  -Wextra \
  -Werror \
  -Ipackages/react-native-nitro-sqlite/cpp \
  -Ipackages/react-native-nitro-sqlite/cpp/sqlite \
  packages/react-native-nitro-sqlite/cpp/NitroSQLiteDatabaseConnections.cpp \
  packages/react-native-nitro-sqlite/cpp/NitroSQLiteDatabaseMigration.cpp \
  packages/react-native-nitro-sqlite/tests/cpp/serialWorker.test.cpp \
  /tmp/sqlite3.o \
  -ldl \
  -lm \
  -pthread \
  -o /tmp/serialWorkerTests
/tmp/serialWorkerTests

clang \
  -std=c11 \
  -DSQLITE_THREADSAFE=0 \
  -c packages/react-native-nitro-sqlite/cpp/sqlite/sqlite3.c \
  -o /tmp/sqlite3-threadsafe-0.o
clang++ \
  -std=c++20 \
  -Wall \
  -Wextra \
  -Werror \
  -Ipackages/react-native-nitro-sqlite/cpp \
  -Ipackages/react-native-nitro-sqlite/cpp/sqlite \
  packages/react-native-nitro-sqlite/cpp/NitroSQLiteDatabaseConnections.cpp \
  packages/react-native-nitro-sqlite/cpp/NitroSQLiteDatabaseMigration.cpp \
  packages/react-native-nitro-sqlite/tests/cpp/databaseConnectionsThreadsafe.test.cpp \
  /tmp/sqlite3-threadsafe-0.o \
  -ldl \
  -lm \
  -pthread \
  -o /tmp/databaseConnectionsThreadsafeTests
/tmp/databaseConnectionsThreadsafeTests
