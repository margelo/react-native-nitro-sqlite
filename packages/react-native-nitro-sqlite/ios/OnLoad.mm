#import <Foundation/Foundation.h>
#import "RNNitroSQLite-Swift-Cxx-Umbrella.hpp"
#import "HybridNitroSQLite.hpp"

@interface OnLoad : NSObject
@end

@implementation OnLoad

using namespace margelo::nitro;
using namespace margelo::nitro::rnnitrosqlite;

+ (void)load {
  // Get appGroupID value from Info.plist using key "AppGroup"
  NSString *appGroupID = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RNNitroSQLite_AppGroup"];
  NSString *documentPath;

  if (appGroupID != nil) {
    // Get the app groups container storage url
    NSFileManager *fileManager = [NSFileManager defaultManager];
    NSURL *storeUrl = [fileManager containerURLForSecurityApplicationGroupIdentifier:appGroupID];

    if (storeUrl == nil) {
      NSLog(@"Invalid AppGroup ID provided (%@). Check the value of \"AppGroup\" in your Info.plist file", appGroupID);
      @throw [NSException exceptionWithName:@"SQLiteInitializationException"
                                     reason:@"Error while initializing SQLite database (AppGroup)"
                                   userInfo:nil];
    }
    NSLog(@"Configured with AppGroup ID: %@", appGroupID);

    documentPath = [storeUrl path];
  } else {
    NSString *databaseLocation = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RNNitroSQLite_DatabaseLocation"];

    if ([databaseLocation isEqualToString:@"ApplicationSupport"]) {
      // Library/Application Support is persistent, backed up, and never exposed to the user
      // via the Files app (unlike the Documents directory, which becomes user-visible when
      // the app enables file sharing).
      NSArray *paths = NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, true);
      documentPath = [paths objectAtIndex:0];

      NSFileManager *fileManager = [NSFileManager defaultManager];
      if (![fileManager fileExistsAtPath:documentPath]) {
        [fileManager createDirectoryAtPath:documentPath withIntermediateDirectories:YES attributes:nil error:nil];
      }

      // Databases created before this option was enabled still live in Documents; each one is
      // moved over when it is opened (see HybridNitroSQLite::open).
      NSString *documentsDirectory = [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, true) objectAtIndex:0];
      HybridNitroSQLite::migrationDocPath = [documentsDirectory UTF8String];
    } else {
      if (databaseLocation != nil && ![databaseLocation isEqualToString:@"Documents"]) {
        NSLog(@"Invalid RNNitroSQLite_DatabaseLocation value provided (%@). Supported values are \"Documents\" and \"ApplicationSupport\". Falling back to \"Documents\".", databaseLocation);
      }
      // Get iOS app's document directory (to safely store database .sqlite3 file)
      NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, true);
      documentPath = [paths objectAtIndex:0];
    }
  }

  HybridNitroSQLite::docPath = [documentPath UTF8String];
}

@end
