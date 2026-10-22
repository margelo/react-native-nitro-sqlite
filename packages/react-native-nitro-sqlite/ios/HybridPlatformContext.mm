#include "hybridObjects/HybridPlatformContext.hpp"
#import <Foundation/Foundation.h>
#import <TargetConditionals.h>
#include <stdexcept>

namespace margelo::nitro::rnnitrosqlite {

namespace {

  [[noreturn]] void throwDirectoryError(NSString* message) {
    throw std::runtime_error(message.UTF8String);
  }

  NSString* appGroupIdentifier() {
    return [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RNNitroSQLite_AppGroup"];
  }

  NSString* searchPathDirectory(NSSearchPathDirectory directory) {
    return NSSearchPathForDirectoriesInDomains(directory, NSUserDomainMask, YES).firstObject;
  }

#if TARGET_OS_OSX
  NSString* macOSDatabaseDirectory() {
    NSFileManager* fileManager = [NSFileManager defaultManager];
    NSError* error = nil;
    NSURL* applicationSupportURL = [fileManager URLForDirectory:NSApplicationSupportDirectory
                                                       inDomain:NSUserDomainMask
                                              appropriateForURL:nil
                                                         create:YES
                                                          error:&error];
    if (applicationSupportURL == nil) {
      throwDirectoryError([NSString stringWithFormat:@"Could not find the Application Support directory: %@", error]);
    }

    NSString* bundleIdentifier = [[NSBundle mainBundle] bundleIdentifier] ?: [[NSProcessInfo processInfo] processName];
    NSURL* databaseURL = [applicationSupportURL URLByAppendingPathComponent:bundleIdentifier isDirectory:YES];
    if (![fileManager createDirectoryAtURL:databaseURL withIntermediateDirectories:YES attributes:nil error:&error]) {
      throwDirectoryError([NSString stringWithFormat:@"Could not create the database directory: %@", error]);
    }
    return databaseURL.path;
  }
#else
  NSString* databaseLocation() {
    return [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RNNitroSQLite_DatabaseLocation"];
  }
#endif

} // namespace

std::string HybridPlatformContext::getDatabaseDirectory() {
  @autoreleasepool {
    NSString* appGroupID = appGroupIdentifier();
    if (appGroupID != nil) {
      NSURL* storeURL = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:appGroupID];
      if (storeURL == nil) {
        NSLog(@"Invalid App Group ID provided (%@). Check the value of \"RNNitroSQLite_AppGroup\" in your Info.plist file", appGroupID);
        throwDirectoryError(@"Error while initializing SQLite database (AppGroup)");
      }
      NSLog(@"Configured with AppGroup ID: %@", appGroupID);
      return storeURL.path.UTF8String;
    }

#if TARGET_OS_OSX
    return macOSDatabaseDirectory().UTF8String;
#else
    NSString* location = databaseLocation();
    if ([location isEqualToString:@"ApplicationSupport"]) {
      // Library/Application Support is persistent, backed up, and never exposed to the user
      // via the Files app, unlike the Documents directory when the app enables file sharing.
      NSString* applicationSupport = searchPathDirectory(NSApplicationSupportDirectory);
      NSFileManager* fileManager = [NSFileManager defaultManager];
      if (![fileManager fileExistsAtPath:applicationSupport]) {
        [fileManager createDirectoryAtPath:applicationSupport withIntermediateDirectories:YES attributes:nil error:nil];
      }
      return applicationSupport.UTF8String;
    }

    if (location != nil && ![location isEqualToString:@"Documents"]) {
      NSLog(@"Invalid RNNitroSQLite_DatabaseLocation value provided (%@). Supported values are \"Documents\" and \"ApplicationSupport\". "
            @"Falling back to \"Documents\".",
            location);
    }
    return searchPathDirectory(NSDocumentDirectory).UTF8String;
#endif
  }
}

std::optional<std::string> HybridPlatformContext::getTemporaryDirectory() {
  return std::nullopt;
}

std::optional<std::string> HybridPlatformContext::getLegacyDatabaseDirectory() {
#if TARGET_OS_OSX
  return std::nullopt;
#else
  @autoreleasepool {
    // Databases created before RNNitroSQLite_DatabaseLocation moved them to Application Support
    // still live in Documents. HybridNitroSQLite moves each one when it is opened.
    if (appGroupIdentifier() != nil || ![databaseLocation() isEqualToString:@"ApplicationSupport"]) {
      return std::nullopt;
    }
    return std::string(searchPathDirectory(NSDocumentDirectory).UTF8String);
  }
#endif
}

} // namespace margelo::nitro::rnnitrosqlite
