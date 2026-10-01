package com.margelo.rnnitrosqlite.example

import android.os.Build
import android.os.Debug
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class BenchmarkMemoryModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
  private val scheduler = Executors.newSingleThreadScheduledExecutor()
  private var sampling: ScheduledFuture<*>? = null
  private var baselineBytes = 0L
  private var peakBytes = 0L

  override fun getName() = "BenchmarkMemory"

  @ReactMethod
  @Synchronized
  fun startSampling(promise: Promise) {
    if (sampling != null) {
      promise.reject("already_sampling", "Memory sampling is already running")
      return
    }

    baselineBytes = currentPssBytes()
    peakBytes = baselineBytes
    sampling = scheduler.scheduleAtFixedRate(
      { updatePeak() },
      0,
      20,
      TimeUnit.MILLISECONDS,
    )
    promise.resolve(null)
  }

  @ReactMethod
  @Synchronized
  fun stopSampling(promise: Promise) {
    val current = sampling
    if (current == null) {
      promise.reject("not_sampling", "Memory sampling has not started")
      return
    }

    current.cancel(false)
    sampling = null
    updatePeak()
    promise.resolve(Arguments.createMap().apply {
      putString("metric", "totalPss")
      putDouble("baselineBytes", baselineBytes.toDouble())
      putDouble("peakBytes", peakBytes.toDouble())
      putInt("intervalMs", 20)
    })
  }

  @ReactMethod
  fun getDeviceIdentifier(promise: Promise) {
    promise.resolve(Build.MODEL)
  }

  @Synchronized
  override fun invalidate() {
    sampling?.cancel(false)
    sampling = null
    scheduler.shutdownNow()
    super.invalidate()
  }

  @Synchronized
  private fun updatePeak() {
    peakBytes = maxOf(peakBytes, currentPssBytes())
  }

  private fun currentPssBytes(): Long {
    val info = Debug.MemoryInfo()
    Debug.getMemoryInfo(info)
    return info.totalPss.toLong() * 1024
  }
}
