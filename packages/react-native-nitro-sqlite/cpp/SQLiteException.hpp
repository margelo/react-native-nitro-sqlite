#pragma once

#include <exception>
#include <iostream>
#include <optional>
#include <string>

const std::string NITRO_SQLITE_EXCEPTION_PREFIX = "[NativeNitroSQLiteException]";

enum SQLiteExceptionType {
  UnknownError,
  DatabaseCannotBeOpened,
  EncryptionNotEnabled,
  DatabaseCannotBeDecrypted,
  DatabaseNotOpen,
  UnableToAttachToDatabase,
  SqlExecutionError,
  CouldNotLoadFile,
  NoBatchCommandsProvided
};

inline std::unordered_map<SQLiteExceptionType, std::string> exceptionTypeStrings = {
    {UnknownError, "UnknownError"},
    {DatabaseCannotBeOpened, "DatabaseCannotBeOpened"},
    {EncryptionNotEnabled, "EncryptionNotEnabled"},
    {DatabaseCannotBeDecrypted, "DatabaseCannotBeDecrypted"},
    {DatabaseNotOpen, "DatabaseNotOpen"},
    {UnableToAttachToDatabase, "UnableToAttachToDatabase"},
    {SqlExecutionError, "SqlExecutionError"},
    {CouldNotLoadFile, "CouldNotLoadFile"},
    {NoBatchCommandsProvided, "NoBatchCommandsProvided"}};

inline std::string typeToString(SQLiteExceptionType type) {
  return exceptionTypeStrings[type];
}

class SQLiteException : public std::exception {
public:
  explicit SQLiteException(const char* message) : SQLiteException(SQLiteExceptionType::UnknownError, message) {}
  explicit SQLiteException(const std::string& message) : SQLiteException(SQLiteExceptionType::UnknownError, message) {}
  SQLiteException(const SQLiteExceptionType& type, const char* message) : SQLiteException(type, std::string(message)) {}
  SQLiteException(const SQLiteExceptionType& type, const std::string& message)
      : _exceptionString(NITRO_SQLITE_EXCEPTION_PREFIX + "[" + typeToString(type) + "] " + message) {}

private:
  const std::string _exceptionString;

public:
  [[nodiscard]] const char* what() const noexcept override {
    return this->_exceptionString.c_str();
  }

  static SQLiteException DatabaseAlreadyOpen(const std::string& dbName) {
    return SQLiteException(SQLiteExceptionType::DatabaseCannotBeOpened,
                           "Database " + dbName + " is already open. There is already a connection to the database.");
  }

  static SQLiteException DatabaseNotOpen(const std::string& dbName) {
    return SQLiteException(SQLiteExceptionType::UnableToAttachToDatabase, dbName + " is not open");
  }

  static SQLiteException SqlExecution(const std::string& errorMessage) {
    return SQLiteException(SQLiteExceptionType::SqlExecutionError, errorMessage);
  }

  static SQLiteException DatabaseFileNotFound(const std::string& dbFilePath) {
    return SQLiteException(SQLiteExceptionType::SqlExecutionError, "Database file not found: " + dbFilePath);
  }

  static SQLiteException CouldNotLoadFile(const std::string& fileLocation, std::optional<std::string> additionalLine = std::nullopt) {
    const auto message = "Could not load file: " + fileLocation + (additionalLine ? (". " + *additionalLine) : "");
    return SQLiteException(SQLiteExceptionType::CouldNotLoadFile, message);
  }
};
