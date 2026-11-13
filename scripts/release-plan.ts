import { execFileSync } from 'node:child_process'
import { readFileSync, appendFileSync } from 'node:fs'

// Semantic versioning 2.0.0 core with optional prerelease identifiers, without build metadata.
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/

/** Resolve a release on the checked-out branch, including patch releases made on sibling branches.
 * Increments from a prerelease finish its version first, so 11.0.0-beta.2 becomes 11.0.0 for patch, minor or major.
 * @param increment A patch, minor, major or prerelease increment, or an exact version such as 11.0.0-beta.0.
 *   A prerelease increment continues the current prerelease, so 11.0.0-beta.0 becomes 11.0.0-beta.1.
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
    .map((tag) => tag.slice(1))
    .filter((version) => versionPattern.test(version))
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
  const version = incrementVersion(baseline, increment)
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
 * @param version Exact version to validate.
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

/** Parse a stable or prerelease semantic version and reject increments, build metadata and malformed inputs. */
export function parseVersion(version: string): [number, number, number] {
  const match = versionPattern.exec(version)
  if (!match) throw new Error('An exact release version is required.')
  const [major, minor, patch] = match.slice(1, 4).map(Number)
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

/** Read a version's prerelease identifiers, such as ['beta', '1'] for 11.0.0-beta.1.
 * @returns An empty list for stable versions.
 */
export function prereleaseIdentifiers(version: string): string[] {
  parseVersion(version)
  const start = version.indexOf('-')
  return start === -1 ? [] : version.slice(start + 1).split('.')
}

/** Compare two versions with semantic versioning precedence, where 11.0.0-beta.2 < 11.0.0-beta.10 < 11.0.0. */
export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left)
  const b = parseVersion(right)
  return (
    a[0] - b[0] ||
    a[1] - b[1] ||
    a[2] - b[2] ||
    comparePrereleases(
      prereleaseIdentifiers(left),
      prereleaseIdentifiers(right),
    )
  )
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

function incrementVersion(baseline: string, increment: string): string {
  const [major, minor, patch] = parseVersion(baseline)
  const prerelease = prereleaseIdentifiers(baseline)
  if (increment === 'major')
    return prerelease.length && !minor && !patch
      ? `${major}.0.0`
      : `${major + 1}.0.0`
  if (increment === 'minor')
    return prerelease.length && !patch
      ? `${major}.${minor}.0`
      : `${major}.${minor + 1}.0`
  if (increment === 'patch')
    return prerelease.length
      ? `${major}.${minor}.${patch}`
      : `${major}.${minor}.${patch + 1}`
  if (increment === 'prerelease') {
    if (!prerelease.length)
      throw new Error(
        'Start a prerelease with an exact version, such as 11.0.0-beta.0.',
      )
    const last = prerelease.at(-1)
    const next =
      last && /^\d+$/.test(last)
        ? [...prerelease.slice(0, -1), String(Number(last) + 1)]
        : [...prerelease, '0']
    return `${major}.${minor}.${patch}-${next.join('.')}`
  }
  parseVersion(increment)
  return increment
}

function comparePrereleases(left: string[], right: string[]): number {
  // A stable version ranks above its prereleases.
  if (!left.length || !right.length) return right.length - left.length
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const a = left[index]
    const b = right[index]
    if (a === b) continue
    const aNumeric = /^\d+$/.test(a)
    const bNumeric = /^\d+$/.test(b)
    if (aNumeric && bNumeric) return Number(a) - Number(b)
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1
    return a < b ? -1 : 1
  }
  return left.length - right.length
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
