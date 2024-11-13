package com.margelo.rnnitrosqlite;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.util.Map;
import java.util.HashMap;
import com.margelo.rnnitrosqlite.NativeNitroSQLiteOnLoadSpec;

public class RNNitroSQLiteOnLoadModule extends NativeNitroSQLiteOnLoadSpec {
  private static ReactApplicationContext _reactContext;
  private Callback reactApplicationContextReadyCallback;

  public RNNitroSQLiteOnLoadModule(ReactApplicationContext reactContext) {
    super(reactContext);
    _reactContext = reactContext;

    var docPathSetter = new DocPathSetter();
    docPathSetter.setDocPath(reactContext);

    if (reactApplicationContextReadyCallback != null) {
      reactApplicationContextReadyCallback.invoke();
    }
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  @Override
  public void onReactApplicationContextReady(Callback callback) {
    if (_reactContext != null) {
      callback.invoke();
      return;
    }

    reactApplicationContextReadyCallback = callback;
  }

  public static ReactApplicationContext getReactContext() {
    return _reactContext;
  }
}
