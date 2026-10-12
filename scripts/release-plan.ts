import { execFileSync } from 'node:child_process'
import { readFileSync, appendFileSync } from 'node:fs'

/** Resolve a stable release on the checked-out branch, including patch releases made on sibling branches.
 * @param increment A patch, minor, major increment or an exact stable version.
 * @returns The previous reachable tag, baseline version and requested version.
 * @throws If no release tag is reachable, the version does not increase, or its tag already exists.
 */
export function releasePlan(increment: string) {
  const previousTag = git(
    'describe',
    '--tags',
    '--match',
    'v[0-9]*',
    '--abbrev=0',
    'HEAD',
  )
  const metadata: unknown = JSON.parse(readFileSync('package.json', 'utf8'))
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('version' in metadata) ||
    typeof metadata.version !== 'string'
  ) {
    throw new Error('The workspace must have a version.')
  }
  const current = parseVersion(metadata.version)
  const tags = git('tag', '--list', 'v*').split('\n')
  const versions = tags
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
    .map((tag) => tag.slice(1))
  const baseline = versions
    .filter((version) => {
      const [major, minor] = parseVersion(version)
      return major === current[0] && minor === current[1]
    })
    .reduce(
      (highest, version) =>
        compareVersions(version, highest) > 0 ? version : highest,
      metadata.version,
    )
  const [major, minor, patch] = parseVersion(baseline)
  const version =
    increment === 'major'
      ? `${major + 1}.0.0`
      : increment === 'minor'
        ? `${major}.${minor + 1}.0`
        : increment === 'patch'
          ? `${major}.${minor}.${patch + 1}`
          : increment
  parseVersion(version)
  if (compareVersions(version, baseline) <= 0)
    throw new Error('The release version must increase.')
  if (tags.includes(`v${version}`))
    throw new Error(
      `Tag v${version} already exists. Use release_tag to resume it.`,
    )
  return {
    version,
    baseline,
    previousTag,
    previousSha: git('rev-list', '-n', '1', previousTag),
  }
}

/** Verify every published package, example version and internal dependency before publication.
 * @param version Exact stable version to validate.
 * @throws If a manifest or internal dependency differs from the release version.
 */
export function validateReleaseVersions(version: string): void {
  parseVersion(version)
  for (const [path, fields] of [
    ['package.json', ['version']],
    ['packages/react-native-nitro-sqlite/package.json', ['version']],
    [
      'packages/react-native-nitro-sqlite-vec/package.json',
      ['version', 'devDependencies.react-native-nitro-sqlite'],
    ],
    [
      'example/package.json',
      [
        'version',
        'dependencies.react-native-nitro-sqlite',
        'dependencies.react-native-nitro-sqlite-vec',
      ],
    ],
  ] satisfies [string, string[]][]) {
    const manifest: unknown = JSON.parse(readFileSync(path, 'utf8'))
    for (const field of fields) {
      const actual = field
        .split('.')
        .reduce<unknown>(
          (value, key) =>
            value && typeof value === 'object'
              ? Reflect.get(value, key)
              : undefined,
          manifest,
        )
      if (actual !== version)
        throw new Error(`${path}: ${field} does not match ${version}`)
    }
  }
}

/** Parse a stable semantic version and reject increments, prereleases and malformed inputs. */
export function parseVersion(version: string): [number, number, number] {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('An exact stable release version is required.')
  }
  const [major, minor, patch] = version.split('.').map(Number)
  if (
    major === undefined ||
    minor === undefined ||
    patch === undefined ||
    ![major, minor, patch].every(Number.isSafeInteger)
  ) {
    throw new Error('Release version components must be safe integers.')
  }
  return [major, minor, patch]
}

/** Compare two stable semantic versions numerically. */
export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/** Require all reported checks, including optional native checks, to finish successfully.
 * Skipped and neutral checks are accepted. Failed checks stop the release immediately.
 * @throws If GitHub returns invalid metadata or a failed check.
 */
export function releaseChecksReady(checks: unknown): boolean {
  if (!Array.isArray(checks))
    throw new Error('GitHub did not return release checks.')
  if (!checks.length) return false
  return checks
    .map((check: unknown) => {
      if (!check || typeof check !== 'object')
        throw new Error('Invalid check metadata.')
      if ('conclusion' in check) {
        if (check.conclusion === null || check.conclusion === undefined)
          return false
        if (typeof check.conclusion !== 'string')
          throw new Error('Invalid check conclusion.')
        if (
          [
            'FAILURE',
            'CANCELLED',
            'TIMED_OUT',
            'ACTION_REQUIRED',
            'STARTUP_FAILURE',
            'STALE',
          ].includes(check.conclusion)
        ) {
          throw new Error(
            'Release PR checks failed. Fix the failure and rerun this job.',
          )
        }
        return (
          'status' in check &&
          check.status === 'COMPLETED' &&
          ['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(check.conclusion)
        )
      }
      if ('state' in check) {
        if (['FAILURE', 'ERROR'].includes(String(check.state)))
          throw new Error('Release PR status checks failed.')
        return check.state === 'SUCCESS'
      }
      throw new Error('Unknown release check metadata.')
    })
    .every(Boolean)
}

/** Run Git without a shell and return trimmed output. */
export function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

/** Read JSON from the GitHub CLI, using its authenticated repository context. */
export function github(...args: string[]): unknown {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }))
}

/** Record a single-line GitHub Actions output. Reject multiline values. */
export function output(name: string, value: string): void {
  if (/[\r\n]/.test(value))
    throw new Error('Workflow outputs must be single-line values.')
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required.')
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
}
