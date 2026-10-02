import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { readLockfile, requireRecord } from './bun-lockfile-workspaces.ts'
import { matchesPaths } from './ci.ts'

/**
 * Detects native dependency changes by comparing locked package resolutions.
 * Packages missing from the installed tree conservatively require Pods.
 * @param before The base lockfile's packages table.
 * @param after The current lockfile's packages table.
 * @param root The repository root containing the installed workspaces.
 * @returns Whether a changed package may affect native dependency resolution.
 * @throws If a locked package has an invalid resolution entry.
 */
export function nativeDependenciesChanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  root: string,
): boolean {
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...names].some((key) => {
    const previous = resolution(before[key])
    const current = resolution(after[key])
    if (previous === current) {
      return false
    }
    const packageName = (current || previous).slice(
      0,
      (current || previous).lastIndexOf('@'),
    )
    return isNativePackage(packageName, root)
  })
}

/**
 * Selects Apple lockfiles after native dependencies or CocoaPods inputs change.
 * @param files Repository-relative paths changed since the base commit.
 * @param nativeChanged Whether a locked native package changed.
 * @param full Whether to validate both Apple platforms unconditionally.
 * @returns Independent iOS and macOS lockfile selections.
 */
export function selectPodChecks(
  files: string[],
  nativeChanged: boolean,
  full: boolean,
) {
  const shared = [
    '**/*.podspec',
    '**/react-native.config.js',
    'example/Gemfile*',
    'patches/**',
  ]
  return {
    ios:
      full ||
      nativeChanged ||
      files.some((file) =>
        matchesPaths(file, [...shared, 'example/ios/Podfile*']),
      ),
    macos:
      full ||
      nativeChanged ||
      files.some((file) =>
        matchesPaths(file, [
          ...shared,
          'example/macos/Podfile*',
          'example/macos/scripts/*config*.js',
          'example/macos/scripts/resolve-react-native.js',
        ]),
      ),
  }
}

function main(): void {
  const base = process.env.CI_BASE_SHA
  const full = process.env.CI_FULL === 'true' || !base || /^0+$/.test(base)
  const current = readLockfile(process.cwd())
  let before = current
  let files: string[] = []
  if (!full && base) {
    const content = execFileSync('git', ['show', `${base}:bun.lock`], {
      encoding: 'utf8',
    })
    const { config, error } = ts.parseConfigFileTextToJson('bun.lock', content)
    if (error) {
      throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'))
    }
    before = requireRecord(config, 'base lockfile')
    files = execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], {
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean)
  }
  const pods = selectPodChecks(
    files,
    nativeDependenciesChanged(
      requireRecord(before.packages, 'base packages'),
      requireRecord(current.packages, 'current packages'),
      process.cwd(),
    ),
    full,
  )
  const output = process.env.GITHUB_OUTPUT
  if (!output) {
    throw new Error('GITHUB_OUTPUT is required')
  }
  appendFileSync(output, `ios_pods=${pods.ios}\nmacos_pods=${pods.macos}\n`)
}

function resolution(value: unknown): string {
  if (value === undefined) {
    return ''
  }
  if (!Array.isArray(value) || typeof value[0] !== 'string') {
    throw new Error('A locked package must have a string resolution')
  }
  return value[0]
}

function isNativePackage(name: string, root: string): boolean {
  if (/(^|\/)react-native($|-)/.test(name)) {
    return true
  }
  const directories = [
    '',
    'example',
    'example/macos',
    'packages/react-native-nitro-sqlite',
    'packages/react-native-nitro-sqlite-vec',
  ]
    .map((workspace) => join(root, workspace, 'node_modules', name))
    .filter((directory) => existsSync(join(directory, 'package.json')))
  if (directories.length === 0) {
    return true
  }
  return directories.some((directory) =>
    [directory, join(directory, 'ios')].some(
      (location) =>
        existsSync(location) &&
        readdirSync(location).some(
          (file) =>
            file.endsWith('.podspec') || file === 'expo-module.config.json',
        ),
    ),
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
}
