import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { matchesGlob, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import patterns from '../.github/ci-paths.json' with { type: 'json' }

/**
 * Selects affected checks using the repository's shared path filters.
 * @param files Repository-relative paths changed since the base commit.
 * @param full Whether to enable all checks, regardless of changed paths.
 * @returns A boolean for each independently selectable check.
 */
export function selectChecks(files: string[], full: boolean) {
  const selected = (paths: string[]) =>
    full || files.some((file) => matchesPaths(file, paths))
  return {
    typescript: selected(patterns.typescript),
    cpp_format: selected(patterns.cpp_format),
    cpp_tests: selected(patterns.cpp_tests),
    docs: selected(patterns.docs),
    android: selected(patterns.android),
    android_configuration: selected([
      '.github/workflows/**',
      'example/android/**/*.gradle*',
      'packages/react-native-nitro-sqlite/android/**/*.gradle*',
      'scripts/android-sqlite-flags/**',
    ]),
    ios: selected(patterns.ios),
    macos: selected(patterns.macos),
  }
}

/**
 * Applies include and exclude globs in order; the last matching rule wins.
 * @param file A repository-relative path.
 * @param paths Glob patterns, with `!` prefixes for exclusions.
 * @returns Whether a matching include remains after applying exclusions.
 */
export function matchesPaths(file: string, paths: string[]): boolean {
  return paths.reduce((included, pattern) => {
    const excluded = pattern.startsWith('!')
    return matchesGlob(file, excluded ? pattern.slice(1) : pattern)
      ? !excluded
      : included
  }, false)
}

function main(): void {
  const base = process.env.CI_BASE_SHA
  const full = process.env.CI_FULL === 'true' || !base || /^0+$/.test(base)
  const files = full
    ? []
    : execFileSync('git', ['diff', '--name-only', '-z', base, 'HEAD'], {
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean)
  const checks = selectChecks(files, full)
  const output = process.env.GITHUB_OUTPUT
  if (!output) {
    throw new Error('GITHUB_OUTPUT is required')
  }
  const dependencies =
    checks.typescript ||
    checks.docs ||
    checks.android ||
    checks.ios ||
    checks.macos
  appendFileSync(
    output,
    Object.entries({ ...checks, dependencies })
      .map(([name, enabled]) => `${name}=${enabled}\n`)
      .join(''),
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
}
