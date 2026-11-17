import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../../../', import.meta.url))
const expo = dirname(require.resolve('expo/package.json'))
const pluginName = 'react-native-nitro-sqlite-expo-plugin'

test(
  'clean Expo prebuild applies native settings and a repeated prebuild is idempotent',
  { timeout: 240_000 },
  () => {
    const project = mkdtempSync(join(tmpdir(), 'nitro-expo-prebuild-'))
    try {
      mkdirSync(join(project, 'node_modules'))
      for (const name of readdirSync(join(root, 'node_modules'))) {
        if (name === 'expo') continue
        symlinkSync(
          join(root, 'node_modules', name),
          join(project, 'node_modules', name),
          'dir',
        )
      }
      symlinkSync(expo, join(project, 'node_modules/expo'), 'dir')
      writeFileSync(
        join(project, 'package.json'),
        JSON.stringify({
          name: 'nitro-plugin-fixture',
          version: '1.0.0',
          private: true,
          dependencies: {
            'expo': require('expo/package.json').version,
            'react': require('react/package.json').version,
            'react-native': require('react-native/package.json').version,
          },
        }),
      )
      function configure(options: object, vector = false) {
        writeFileSync(
          join(project, 'app.json'),
          JSON.stringify({
            expo: {
              name: 'NitroPluginFixture',
              slug: 'nitro-plugin-fixture',
              ios: {
                bundleIdentifier: 'com.example.nitrofixture',
                infoPlist: { FixtureValue: 'keep' },
                entitlements: {
                  'com.apple.security.application-groups': [
                    'group.com.example.existing',
                  ],
                },
              },
              android: { package: 'com.example.nitrofixture' },
              plugins: [
                [pluginName, options],
                ...(vector ? [`${pluginName}/vec`] : []),
              ],
            },
          }),
        )
      }
      function prebuild(clean: boolean) {
        try {
          execFileSync(
            process.execPath,
            [
              join(expo, 'bin/cli'),
              'prebuild',
              '--no-install',
              '--platform',
              'all',
              '--skip-dependency-update',
              'react,react-native',
              ...(clean ? ['--clean'] : []),
            ],
            {
              cwd: project,
              stdio: 'pipe',
              timeout: 120_000,
              env: {
                ...process.env,
                CI: '1',
                EXPO_NO_TELEMETRY: '1',
                EXPO_NO_GIT_STATUS: '1',
              },
            },
          )
        } catch (error) {
          if (error && typeof error === 'object' && 'stderr' in error)
            throw new Error(String(error.stderr), { cause: error })
          throw error
        }
      }
      function outputs() {
        const ios = join(project, 'ios')
        const app = readdirSync(ios).find(
          (name) => name === 'NitroPluginFixture',
        )
        assert.ok(app)
        return {
          properties: JSON.parse(
            readFileSync(join(ios, 'Podfile.properties.json'), 'utf8'),
          ),
          plist: readFileSync(join(ios, app, 'Info.plist'), 'utf8'),
          entitlements: readFileSync(
            join(ios, app, `${app}.entitlements`),
            'utf8',
          ),
          gradle: readFileSync(
            join(project, 'android/gradle.properties'),
            'utf8',
          ),
          podfile: readFileSync(join(ios, 'Podfile'), 'utf8'),
        }
      }
      configure({})
      prebuild(true)
      const defaults = outputs()
      assert.equal(defaults.properties['nitroSqlite.vec'], undefined)
      assert.equal(defaults.properties['nitroSqlite.flags'], undefined)
      assert.doesNotMatch(defaults.gradle, /nitroSqliteVec|nitroSqliteFlags/)

      configure(
        {
          fts5: true,
          ios: { appGroup: 'group.com.example.shared' },
          sqliteFlags: {
            ios: ['SQLITE_ENABLE_GEOPOLY=1'],
            android: ['-DSQLITE_ENABLE_GEOPOLY=1'],
          },
        },
        true,
      )
      prebuild(true)
      const configured = outputs()
      assert.equal(
        configured.properties['nitroSqlite.flags'],
        'SQLITE_ENABLE_GEOPOLY=1 SQLITE_ENABLE_FTS5=1',
      )
      assert.equal(configured.properties['nitroSqlite.vec'], 'true')
      assert.match(
        configured.plist,
        /<key>RNNitroSQLite_AppGroup<\/key>\s*<string>group.com.example.shared<\/string>/,
      )
      assert.match(
        configured.plist,
        /<key>FixtureValue<\/key>\s*<string>keep<\/string>/,
      )
      assert.match(configured.entitlements, /group.com.example.existing/)
      assert.match(configured.entitlements, /group.com.example.shared/)
      assert.match(
        configured.gradle,
        /nitroSqliteFlags=-DSQLITE_ENABLE_GEOPOLY=1 -DSQLITE_ENABLE_FTS5=1/,
      )
      assert.match(configured.gradle, /nitroSqliteVec=true/)
      assert.equal(configured.podfile, defaults.podfile)
      prebuild(false)
      assert.deepEqual(outputs(), configured)

      configure({ ios: { useSystemSqlite: true } })
      prebuild(true)
      const system = outputs()
      assert.equal(system.properties['nitroSqlite.useSystemSqlite'], 'true')
      assert.equal(system.properties['nitroSqlite.flags'], undefined)
      assert.equal(system.properties['nitroSqlite.vec'], undefined)
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  },
)
