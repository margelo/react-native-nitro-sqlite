import { execFileSync } from 'node:child_process'
import { GitHub, Manifest } from 'release-please'
import {
  github,
  output,
  parseVersion,
  releaseChecksReady,
} from './release-plan.ts'

const {
  GH_TOKEN,
  GITHUB_REPOSITORY,
  GITHUB_REF_NAME,
  RELEASE_PR,
  RELEASE_VERSION,
} = process.env
if (
  !GH_TOKEN ||
  !GITHUB_REPOSITORY ||
  !GITHUB_REF_NAME ||
  !RELEASE_PR ||
  !RELEASE_VERSION
) {
  throw new Error(
    'Release token, repository, branch, PR and version are required.',
  )
}
parseVersion(RELEASE_VERSION)
const expectedHead = prField('headRefOid')
for (let attempt = 0; ; attempt++) {
  if (prField('headRefOid') !== expectedHead)
    throw new Error(
      'Release PR changed while waiting. Start a new release run.',
    )
  const state = prField('state')
  if (state === 'CLOSED')
    throw new Error('Release PR was closed without merging.')
  if (state === 'MERGED') break
  if (attempt >= 120)
    throw new Error(
      'Release PR still needs checks or required reviews. Complete them and rerun this job.',
    )
  // GitHub enforces required checks and reviews. Never use an admin override.
  const checks = github(
    'pr',
    'view',
    RELEASE_PR,
    '--repo',
    GITHUB_REPOSITORY,
    '--json',
    'statusCheckRollup',
    '--jq',
    '.statusCheckRollup',
  )
  if (releaseChecksReady(checks) && prField('mergeStateStatus') === 'CLEAN') {
    execFileSync(
      'gh',
      [
        'pr',
        'merge',
        RELEASE_PR,
        '--repo',
        GITHUB_REPOSITORY,
        '--squash',
        '--match-head-commit',
        expectedHead,
      ],
      { stdio: 'inherit' },
    )
  } else {
    console.log('Waiting for release PR checks and required reviews.')
    await new Promise((resolve) => setTimeout(resolve, 30_000))
  }
}
const [owner, repo] = GITHUB_REPOSITORY.split('/')
if (!owner || !repo) throw new Error('Invalid repository.')
const client = await GitHub.create({
  owner,
  repo,
  token: GH_TOKEN,
  defaultBranch: GITHUB_REF_NAME,
})
const manifest = await Manifest.fromManifest(client, GITHUB_REF_NAME)
const releases = (await manifest.createReleases()).filter(
  (release) => release?.tagName === `v${RELEASE_VERSION}`,
)
if (releases.length !== 1)
  throw new Error(
    'Release Please did not create the expected draft. Retry publication with release_tag if it already exists.',
  )
output('tag', `v${RELEASE_VERSION}`)

function prField(field: string): string {
  if (!RELEASE_PR || !GITHUB_REPOSITORY)
    throw new Error('Release PR and repository are required.')
  const metadata = github(
    'pr',
    'view',
    RELEASE_PR,
    '--repo',
    GITHUB_REPOSITORY,
    '--json',
    field,
  )
  if (!metadata || typeof metadata !== 'object')
    throw new Error('Invalid PR metadata.')
  const value: unknown = Reflect.get(metadata, field)
  if (typeof value !== 'string') throw new Error(`Invalid PR field: ${field}`)
  return value
}
