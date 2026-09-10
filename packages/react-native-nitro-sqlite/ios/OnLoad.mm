#import <Foundation/Foundation.h>
#import <TargetConditionals.h>
#import "RNNitroSQLite-Swift-Cxx-Umbrella.hpp"
#import "HybridNitroSQLite.hpp"

static NSString *defaultDatabaseDirectory(void) {
  NSFileManager *fileManager = [NSFileManager defaultManager];

#if TARGET_OS_OSX
  NSError *error = nil;
  NSURL *applicationSupportURL = [fileManager URLForDirectory:NSApplicationSupportDirectory
                                                      inDomain:NSUserDomainMask
                                             appropriateForURL:nil
                                                        create:YES
                                                         error:&error];
  if (applicationSupportURL == nil) {
    @throw [NSException exceptionWithName:@"SQLiteInitializationException"
                                   reason:[NSString stringWithFormat:@"Could not find the Application Support directory: %@", error]
                                 userInfo:nil];
  }

  NSString *bundleIdentifier = [[NSBundle mainBundle] bundleIdentifier];
  if (bundleIdentifier == nil) {
    bundleIdentifier = [[NSProcessInfo processInfo] processName];
  }

  NSURL *databaseURL = [applicationSupportURL URLByAppendingPathComponent:bundleIdentifier isDirectory:YES];
  if (![fileManager createDirectoryAtURL:databaseURL withIntermediateDirectories:YES attributes:nil error:&error]) {
    @throw [NSException exceptionWithName:@"SQLiteInitializationException"
                                   reason:[NSString stringWithFormat:@"Could not create the database directory: %@", error]
                                 userInfo:nil];
  }

  return [databaseURL path];
#else
  NSURL *documentsURL = [fileManager URLForDirectory:NSDocumentDirectory
                                             inDomain:NSUserDomainMask
                                    appropriateForURL:nil
                                               create:YES
                                                error:nil];
  if (documentsURL == nil) {
    @throw [NSException exceptionWithName:@"SQLiteInitializationException"
                                   reason:@"Could not find the Documents directory"
                                 userInfo:nil];
  }

  return [documentsURL path];
#endif
}

@interface OnLoad : NSObject
@end

@implementation OnLoad

using namespace margelo::nitro;
using namespace margelo::nitro::rnnitrosqlite;

+ (void)load {
  // Get appGroupID value from Info.plist using key "RNNitroSQLite_AppGroup".
  NSString *appGroupID = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RNNitroSQLite_AppGroup"];
  NSString *documentPath;

  if (appGroupID != nil) {
    // Get the app groups container storage url
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSURL *storeUrl = [fileManager containerURLForSecurityApplicationGroupIdentifier:appGroupID];

    if (storeUrl == nil) {
      NSLog(@"Invalid App Group ID provided (%@). Check the value of \"RNNitroSQLite_AppGroup\" in your Info.plist file", appGroupID);
      @throw [NSException exceptionWithName:@"SQLiteInitializationException"
                                     reason:@"Error while initializing SQLite database (AppGroup)"
                                   userInfo:nil];
    }
    NSLog(@"Configured with AppGroup ID: %@", appGroupID);

    documentPath = [storeUrl path];
  } else {
    documentPath = defaultDatabaseDirectory();
  }

  HybridNitroSQLite::docPath = [documentPath UTF8String];
}

@end
