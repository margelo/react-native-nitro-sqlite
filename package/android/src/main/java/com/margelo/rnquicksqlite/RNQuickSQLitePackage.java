package com.margelo.rnquicksqlite;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;
import com.facebook.react.TurboReactPackage;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class RNQuickSQLitePackage extends TurboReactPackage {
  static {
    System.loadLibrary("RNQuickSQLite");
  }

  @Nullable
  @Override
  public NativeModule getModule(String name, ReactApplicationContext reactContext) {
    if (name.equals(RNQuickSQLiteInitModule.NAME)) {
      return new RNQuickSQLiteInitModule(reactContext);
    } else {
      return null;
    }
  }

  @Override
  public ReactModuleInfoProvider getReactModuleInfoProvider() {
    return () -> {
      final Map<String, ReactModuleInfo> moduleInfos = new HashMap<>();
      moduleInfos.put(
          RNQuickSQLiteInitModule.NAME,
          new ReactModuleInfo(
              RNQuickSQLiteInitModule.NAME,
              RNQuickSQLiteInitModule.NAME,
              false,
              true,
              true,
              false,
              true));
      return moduleInfos;
    };
  }
}
