#import "SQLiteVecRegisterVectorExtensions.hpp"
#import <Foundation/Foundation.h>

// Swift Package Manager builds this package separately from the core, so register before any database opens.
@interface NitroSQLiteVecOnLoad : NSObject
@end

@implementation NitroSQLiteVecOnLoad

+ (void)load {
  margelo::rnnitrosqlitevec::registerVectorExtensions();
}

@end
