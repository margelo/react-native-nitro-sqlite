import { compareVersions, parseVersion } from './release-plan.ts'

/** Packages published together, in dependency order. */
export const releasePackages = [
  'react-native-nitro-sqlite',
  'react-native-nitro-sqlite-vec',
]

/** Select the channel without moving latest backwards on maintenance releases.
 * Version 9 always uses legacy-9; older versions of other lines use maintenance-MAJOR.MINOR.
 * @param version Stable version to publish.
 * @returns The distribution tag shared by both packages.
 * @throws On unavailable or malformed npm registry metadata.
 */
export async function distributionTag(version: string): Promise<string> {
  const [major, minor] = parseVersion(version)
  if (major === 9) return 'legacy-9'
  for (const name of releasePackages) {
    const latest = await registry(`${name}/latest`, true)
    if (
      typeof latest?.version === 'string' &&
      compareVersions(latest.version, version) > 0
    ) {
      return `maintenance-${major}.${minor}`
    }
  }
  return 'latest'
}

/** Find packages that still need publication after checking both existing versions.
 * Existing versions must record the selected release commit in their gitHead metadata.
 * @returns Unpublished package names, in dependency order.
 * @throws If a version already exists from another commit, or the registry is unavailable.
 */
export async function pendingPackages(
  version: string,
  commit: string,
): Promise<string[]> {
  parseVersion(version)
  const pending: string[] = []
  for (const name of releasePackages) {
    const metadata = await registry(`${name}/${version}`, true)
    if (!metadata) {
      pending.push(name)
      continue
    }
    if (metadata.gitHead !== commit)
      throw new Error(`${name}@${version} belongs to a different commit.`)
    console.log(`${name}@${version} already published from this commit.`)
  }
  return pending
}

/** Check every pending package's trusted publisher before any package is published.
 * OIDC exchange tokens are used only for this check and are never logged or stored.
 * @throws If GitHub OIDC or either package's trusted publisher is unavailable.
 */
export async function checkTrustedPublishers(
  packages: string[],
): Promise<void> {
  const { ACTIONS_ID_TOKEN_REQUEST_URL, ACTIONS_ID_TOKEN_REQUEST_TOKEN } =
    process.env
  if (!packages.length) return
  if (!ACTIONS_ID_TOKEN_REQUEST_URL || !ACTIONS_ID_TOKEN_REQUEST_TOKEN)
    throw new Error('GitHub OIDC is unavailable.')
  for (const name of packages) {
    const url = new URL(ACTIONS_ID_TOKEN_REQUEST_URL)
    url.searchParams.set('audience', 'npm:registry.npmjs.org')
    const identity = await fetch(url, {
      headers: { Authorization: `Bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
    })
    if (!identity.ok) throw new Error(`OIDC request failed: ${identity.status}`)
    const data: unknown = await identity.json()
    if (
      !data ||
      typeof data !== 'object' ||
      !('value' in data) ||
      typeof data.value !== 'string' ||
      !data.value
    )
      throw new Error('OIDC returned no token.')
    const exchange = await fetch(
      `https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.value}` },
      },
    )
    if (!exchange.ok)
      throw new Error(`${name}: npm OIDC exchange failed (${exchange.status})`)
    const result: unknown = await exchange.json()
    if (
      !result ||
      typeof result !== 'object' ||
      !('token' in result) ||
      typeof result.token !== 'string' ||
      !result.token
    )
      throw new Error(`${name}: npm returned no token.`)
    console.log(`${name}: trusted publishing is available.`)
  }
}

/** Confirm the published version records the selected commit, allowing registry propagation.
 * @throws After one minute if the version is missing or its commit differs.
 */
export async function verifyPublication(
  name: string,
  version: string,
  commit: string,
): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const metadata = await registry(`${name}/${version}`, true)
    if (metadata?.gitHead === commit) return
    if (metadata)
      throw new Error(`${name}: published commit differs from the release tag.`)
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
  throw new Error(
    `${name}: published version could not be verified. Resume with release_tag.`,
  )
}

async function registry(
  path: string,
  allowMissing = false,
): Promise<Record<string, unknown> | undefined> {
  const response = await fetch(`https://registry.npmjs.org/${path}`)
  if (allowMissing && response.status === 404) return undefined
  if (!response.ok)
    throw new Error(`npm registry request failed: ${response.status}`)
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Invalid npm registry metadata.')
  return Object.fromEntries(Object.entries(data))
}
