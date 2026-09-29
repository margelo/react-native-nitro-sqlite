import { NativeModules, Platform } from 'react-native'

export type MemoryMeasurement =
  | {
      status: 'measured'
      metric: 'physicalFootprint' | 'totalPss'
      baselineBytes: number
      peakBytes: number
      increaseBytes: number
      intervalMs: number
    }
  | { status: 'unavailable'; reason: string }

interface NativeMemoryMeasurement {
  metric: 'physicalFootprint' | 'totalPss'
  baselineBytes: number
  peakBytes: number
  intervalMs: number
}

interface BenchmarkMemoryModule {
  startSampling(): Promise<void>
  stopSampling(): Promise<NativeMemoryMeasurement>
  getDeviceIdentifier(): Promise<string>
}

const nativeMemory = NativeModules.BenchmarkMemory as
  | BenchmarkMemoryModule
  | undefined

export async function measureProcessMemory(
  run: () => unknown | Promise<unknown>,
): Promise<MemoryMeasurement> {
  if (nativeMemory == null) {
    return {
      status: 'unavailable',
      reason: `No process memory sampler for ${Platform.OS}`,
    }
  }

  await nativeMemory.startSampling()
  let nativeResult: NativeMemoryMeasurement
  try {
    await run()
  } finally {
    nativeResult = await nativeMemory.stopSampling()
  }

  return {
    status: 'measured',
    ...nativeResult,
    increaseBytes: Math.max(
      0,
      nativeResult.peakBytes - nativeResult.baselineBytes,
    ),
  }
}

export async function getDeviceIdentifier(): Promise<string | undefined> {
  try {
    return await nativeMemory?.getDeviceIdentifier()
  } catch {
    return undefined
  }
}
