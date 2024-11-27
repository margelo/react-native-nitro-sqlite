#pragma once

#include <string>
#include <iostream>
#include <exception>

enum NitroSQLiteExceptionType {
  UnknownError,
  DatabaseCannotBeOpened,
  DatabaseNotOpen,
  UnableToAttachToDatabase,
  SqlExecutionError,
  CouldNotLoadFile,
  NoBatchCommandsProvided
};

inline std::unordered_map<NitroSQLiteExceptionType, std::string> exceptionTypeStrings = {
  {UnknownError, "UnknownError"},
  {DatabaseCannotBeOpened, "DatabaseCannotBeOpened"},
  {DatabaseNotOpen, "DatabaseNotOpen"},
  {UnableToAttachToDatabase, "UnableToAttachToDatabase"},
  {SqlExecutionError, "SqlExecutionError"},
  {CouldNotLoadFile, "CouldNotLoadFile"},
  {NoBatchCommandsProvided, "NoBatchCommandsProvided"}
};

inline std::string typeToString(NitroSQLiteExceptionType type) {
  return exceptionTypeStrings[type];
}

class NitroSQLiteException : public std::runtime_error {
public:
  explicit NitroSQLiteException(const char* message): NitroSQLiteException(NitroSQLiteExceptionType::UnknownError, message) {}
  explicit NitroSQLiteException(const std::string& message): NitroSQLiteException(NitroSQLiteExceptionType::UnknownError, message) {}
  NitroSQLiteException(const NitroSQLiteExceptionType& type, const char* message) : NitroSQLiteException(type, std::string(message)) {}
  NitroSQLiteException(const NitroSQLiteExceptionType& type, const std::string& message)
    : std::runtime_error("[react-native-nitro-sqlite] " + typeToString(type) + ": " + message) {}

public:
  static NitroSQLiteException DatabaseNotOpen(const std::string& dbName) {
    return NitroSQLiteException(NitroSQLiteExceptionType::UnableToAttachToDatabase, dbName + " is not open");
  }

  static NitroSQLiteException SqlExecution(const std::string& errorMessage) {
    return NitroSQLiteException(NitroSQLiteExceptionType::SqlExecutionError, errorMessage);
  }

  static NitroSQLiteException DatabaseFileNotFound(const std::string& dbFilePath) {
    return NitroSQLiteException(NitroSQLiteExceptionType::SqlExecutionError, "Database file not found: " + dbFilePath);
  }

  static NitroSQLiteException CouldNotLoadFile(const std::string& fileLocation, std::optional<std::string> additionalLine = std::nullopt) {
    const auto message = "Could not load file: " + fileLocation + (additionalLine ? (". " + *additionalLine) : "");
    return NitroSQLiteException(NitroSQLiteExceptionType::CouldNotLoadFile, message);
  }
};
