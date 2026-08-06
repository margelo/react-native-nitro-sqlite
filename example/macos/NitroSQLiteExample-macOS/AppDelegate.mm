#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  self.moduleName = @"NitroSQLiteExample";
  NSString *testReportURL = NSProcessInfo.processInfo.environment[@"NITRO_SQLITE_TEST_REPORT_URL"];
  self.initialProps = testReportURL.length > 0 ? @{ @"macosTestReportUrl" : testReportURL } : @{};
  self.dependencyProvider = [RCTAppDependencyProvider new];

  return [super applicationDidFinishLaunching:notification];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  NSString *testMetroPort = NSProcessInfo.processInfo.environment[@"NITRO_SQLITE_TEST_METRO_PORT"];
  if (testMetroPort.length > 0) {
    return [RCTBundleURLProvider jsBundleURLForBundleRoot:@"index"
                                              packagerHost:[NSString stringWithFormat:@"127.0.0.1:%@", testMetroPort]
                                                 enableDev:YES
                                        enableMinification:NO
                                           inlineSourceMap:NO];
  }

  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

/// This method controls whether the `concurrentRoot`feature of React18 is turned on or off.
///
/// @see: https://reactjs.org/blog/2022/03/29/react-v18.html
/// @note: This requires to be rendering on Fabric (i.e. on the New Architecture).
/// @return: `true` if the `concurrentRoot` feature is enabled. Otherwise, it returns `false`.
- (BOOL)concurrentRootEnabled
{
#ifdef RN_FABRIC_ENABLED
  return true;
#else
  return false;
#endif
}

@end
