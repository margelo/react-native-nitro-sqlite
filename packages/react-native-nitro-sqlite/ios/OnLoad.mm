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
    // Get iOS app's document directory (to safely store database .sqlite3 file)
    NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, true);
    documentPath = [paths objectAtIndex:0];
  }

  HybridNitroSQLite::docPath = [documentPath UTF8String];
}

@end
