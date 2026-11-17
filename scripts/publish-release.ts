import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { git, validateReleaseVersions } from './release-plan.ts'
import {
  checkTrustedPublishers,
  distributionTag,
  pendingPackages,
  releasePackages,
  verifyPublication,
} from './release-registry.ts'

/** Build and validate both packages before publishing either package from the selected tag.
 * Checks internal versions, lockfiles, source cleanliness, existing publications and both trusted publishers.
 * Retries skip packages whose registry metadata records the same release commit.
 * A version npm still processes from an earlier attempt counts as published once verification confirms its commit.
 * @param version Exact version already committed and tagged by Release Please.
 * @throws Before publication on failed validation, or after publication if registry verification fails.
 */
export async function publishRelease(version: string): Promise<void> {
  validateReleaseVersions(version)
  const commit = git('rev-parse', 'HEAD')
  if (git('rev-list', '-n', '1', `v${version}`) !== commit)
    throw new Error('Release tag does not match HEAD.')
  execFileSync('bun', ['run', 'check:lockfile'], { stdio: 'inherit' })
  for (const name of releasePackages) {
    const cwd = `packages/${name}`
    execFileSync('bun', ['run', 'typecheck'], { cwd, stdio: 'inherit' })
    execFileSync('bun', ['run', 'lint'], { cwd, stdio: 'inherit' })
  }
  execFileSync('bun', ['run', 'build'], {
    cwd: 'packages/react-native-nitro-sqlite',
    stdio: 'inherit',
  })
  if (git('status', '--porcelain', '--untracked-files=no'))
    throw new Error(
      'Package checks changed tracked files. Fix and commit them before publishing.',
    )
  const pending = await pendingPackages(version, commit)
  await checkTrustedPublishers(pending)
  const tag = await distributionTag(version)
  for (const name of pending) {
    // npm's CLI exchanges GitHub OIDC credentials and records provenance without a publishing token.
    const result = spawnSync(
      'npm',
      [
        'publish',
        '--access',
        'public',
        '--provenance',
        '--tag',
        tag,
        '--workspaces=false',
      ],
      {
        cwd: `packages/${name}`,
        stdio: ['inherit', 'inherit', 'pipe'],
        encoding: 'utf8',
      },
    )
    const stderr = result.stderr ?? ''
    process.stderr.write(stderr)
    // npm hides a new version for several minutes and rejects a second publish of it until then.
    const stagedByEarlierAttempt = /previously staged version/.test(stderr)
    if (result.status !== 0 && !stagedByEarlierAttempt)
      throw new Error(`${name}: npm publish failed.`, { cause: result.error })
  }
  // Verify after publishing every package, so npm's processing delays overlap.
  for (const name of pending) await verifyPublication(name, version, commit)
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const version = process.argv[2]
  if (!version) throw new Error('Provide the release version.')
  await publishRelease(version)
}
