import React, { useState } from 'react'
import Clipboard from '@react-native-clipboard/clipboard'
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import {
  seedMigrationFixture,
  verifyMigrationFixture,
  type MigrationFixture,
} from '../migrationTest'

type TestStatus =
  | { kind: 'idle' }
  | { kind: 'seeded'; fixture: MigrationFixture }
  | { kind: 'verified'; fixture: MigrationFixture }
  | { kind: 'failed'; message: string }

export function MigrationTestScreen() {
  const [expectedMarker, setExpectedMarker] = useState('')
  const [status, setStatus] = useState<TestStatus>({ kind: 'idle' })
  const [isRunning, setIsRunning] = useState(false)

  function seed() {
    if (isRunning) {
      return
    }

    setIsRunning(true)
    try {
      const fixture = seedMigrationFixture()
      setExpectedMarker(fixture.marker)
      setStatus({ kind: 'seeded', fixture })
    } catch (error) {
      setStatus({ kind: 'failed', message: getErrorMessage(error) })
    } finally {
      setIsRunning(false)
    }
  }

  function verify() {
    if (isRunning) {
      return
    }

    setIsRunning(true)
    try {
      const fixture = verifyMigrationFixture(expectedMarker)
      setStatus({ kind: 'verified', fixture })
    } catch (error) {
      setStatus({ kind: 'failed', message: getErrorMessage(error) })
    } finally {
      setIsRunning(false)
    }
  }

  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.content}>
        <Text style={styles.title}>Database migration</Text>
        <Text style={styles.body}>
          This test needs iOS because the database location is selected by the
          app&apos;s Info.plist.
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Database migration</Text>
      <Text style={styles.body}>
        This is a two-build test. Change RNNitroSQLite_DatabaseLocation in
        example/ios/NitroSQLiteExample/Info.plist, then rebuild the native app.
        Keep the same app installation and bundle ID between builds.
      </Text>

      <Text style={styles.stepTitle}>1. Seed in Documents</Text>
      <Text style={styles.body}>
        With the Info.plist value set to Documents, build the app and seed both
        test databases. Copy the marker before replacing this build.
      </Text>
      <TouchableOpacity
        accessibilityRole="button"
        disabled={isRunning}
        onPress={seed}
        style={[styles.button, isRunning && styles.disabledButton]}
        testID="migration-seed-button"
      >
        <Text style={styles.buttonText}>Seed test databases</Text>
      </TouchableOpacity>

      <Text style={styles.stepTitle}>2. Verify in Application Support</Text>
      <Text style={styles.body}>
        Set the Info.plist value to ApplicationSupport and install the new build
        over the old one. Do not uninstall the app or seed again. Paste the
        marker and verify that both databases moved with their data intact.
      </Text>
      <TextInput
        accessibilityLabel="Marker from the Documents build"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setExpectedMarker}
        placeholder="Marker from the Documents build"
        style={styles.markerInput}
        testID="migration-marker-input"
        value={expectedMarker}
      />
      <TouchableOpacity
        accessibilityRole="button"
        disabled={isRunning}
        onPress={verify}
        style={[styles.button, isRunning && styles.disabledButton]}
        testID="migration-verify-button"
      >
        <Text style={styles.buttonText}>Verify migration</Text>
      </TouchableOpacity>

      {status.kind === 'seeded' && (
        <View
          style={styles.result}
          testID="migration-seeded-result"
        >
          <Text style={styles.successText}>Seeded in Documents</Text>
          <Text
            selectable
            style={styles.marker}
          >
            {status.fixture.marker}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => Clipboard.setString(status.fixture.marker)}
            style={styles.copyButton}
            testID="migration-copy-marker-button"
          >
            <Text style={styles.copyText}>Copy marker</Text>
          </TouchableOpacity>
          <Text
            selectable
            style={styles.path}
          >
            Main: {status.fixture.mainPath}
          </Text>
          <Text
            selectable
            style={styles.path}
          >
            Attached: {status.fixture.attachedPath}
          </Text>
        </View>
      )}
      {status.kind === 'verified' && (
        <View
          style={styles.result}
          testID="migration-verified-result"
        >
          <Text style={styles.successText}>Migration verified</Text>
          <Text style={styles.body}>
            Both markers match. Both database paths are in Library/Application
            Support, and both databases pass integrity_check.
          </Text>
          <Text
            selectable
            style={styles.path}
          >
            Main: {status.fixture.mainPath}
          </Text>
          <Text
            selectable
            style={styles.path}
          >
            Attached: {status.fixture.attachedPath}
          </Text>
        </View>
      )}
      {status.kind === 'failed' && (
        <View
          style={styles.result}
          testID="migration-failed-result"
        >
          <Text style={styles.errorText}>Test failed</Text>
          <Text
            selectable
            style={styles.body}
          >
            {status.message}
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: { color: '#374151', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  stepTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  disabledButton: { opacity: 0.5 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  markerInput: {
    backgroundColor: 'white',
    borderColor: '#9ca3af',
    borderRadius: 8,
    borderWidth: 1,
    color: '#111827',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  result: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginTop: 20,
    padding: 16,
  },
  successText: {
    color: '#166534',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  marker: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  copyText: { color: '#1d4ed8', fontSize: 15, marginBottom: 12 },
  copyButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  path: { color: '#4b5563', fontSize: 12, marginTop: 6 },
})
