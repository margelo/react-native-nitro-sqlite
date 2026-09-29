#import <React/RCTBridgeModule.h>
#import <mach/mach.h>
#import <stdlib.h>
#import <sys/sysctl.h>

@interface BenchmarkMemory : NSObject <RCTBridgeModule>
@end

@implementation BenchmarkMemory {
  dispatch_queue_t _queue;
  dispatch_source_t _timer;
  uint64_t _baselineBytes;
  uint64_t _peakBytes;
}

RCT_EXPORT_MODULE()

- (dispatch_queue_t)methodQueue {
  if (_queue == nil) {
    _queue = dispatch_queue_create("com.margelo.benchmark.memory", DISPATCH_QUEUE_SERIAL);
  }
  return _queue;
}

RCT_EXPORT_METHOD(startSampling:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (_timer != nil) {
    reject(@"already_sampling", @"Memory sampling is already running", nil);
    return;
  }

  _baselineBytes = [self currentFootprint];
  if (_baselineBytes == 0) {
    reject(@"sampling_failed", @"Could not read the process footprint", nil);
    return;
  }

  _peakBytes = _baselineBytes;
  _timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, self.methodQueue);
  dispatch_source_set_timer(_timer, dispatch_time(DISPATCH_TIME_NOW, 0),
                            20 * NSEC_PER_MSEC, 2 * NSEC_PER_MSEC);
  __weak typeof(self) weakSelf = self;
  dispatch_source_set_event_handler(_timer, ^{
    [weakSelf updatePeak];
  });
  dispatch_resume(_timer);
  resolve(nil);
}

RCT_EXPORT_METHOD(stopSampling:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (_timer == nil) {
    reject(@"not_sampling", @"Memory sampling has not started", nil);
    return;
  }

  [self updatePeak];
  dispatch_source_cancel(_timer);
  _timer = nil;
  resolve(@{
    @"metric": @"physicalFootprint",
    @"baselineBytes": @(_baselineBytes),
    @"peakBytes": @(_peakBytes),
    @"intervalMs": @20
  });
}

RCT_EXPORT_METHOD(getDeviceIdentifier:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *simulatorModel = NSProcessInfo.processInfo.environment[@"SIMULATOR_MODEL_IDENTIFIER"];
  if (simulatorModel.length > 0) {
    resolve(simulatorModel);
    return;
  }

  size_t size = 0;
  if (sysctlbyname("hw.machine", NULL, &size, NULL, 0) != 0 || size == 0) {
    reject(@"device_unknown", @"Could not read the device identifier", nil);
    return;
  }
  char *machine = malloc(size);
  if (machine == NULL || sysctlbyname("hw.machine", machine, &size, NULL, 0) != 0) {
    free(machine);
    reject(@"device_unknown", @"Could not read the device identifier", nil);
    return;
  }
  resolve([NSString stringWithUTF8String:machine]);
  free(machine);
}

- (void)invalidate {
  dispatch_async(self.methodQueue, ^{
    if (self->_timer != nil) {
      dispatch_source_cancel(self->_timer);
      self->_timer = nil;
    }
  });
}

- (void)updatePeak {
  _peakBytes = MAX(_peakBytes, [self currentFootprint]);
}

- (uint64_t)currentFootprint {
  task_vm_info_data_t info;
  mach_msg_type_number_t count = TASK_VM_INFO_COUNT;
  kern_return_t result = task_info(mach_task_self(), TASK_VM_INFO,
                                   (task_info_t)&info, &count);
  return result == KERN_SUCCESS ? info.phys_footprint : 0;
}

@end
