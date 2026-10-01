import { GitHub, Manifest } from 'release-please'
import { Version } from 'release-please/build/src/version.js'
import { releasePlan, output } from './release-plan.ts'

const { GH_TOKEN, GITHUB_REPOSITORY, GITHUB_REF_NAME, RELEASE_INCREMENT } =
  process.env
if (!GH_TOKEN || !GITHUB_REPOSITORY || !GITHUB_REF_NAME || !RELEASE_INCREMENT) {
  throw new Error(
    'Release token, repository, selected branch and increment are required.',
  )
}
const [owner, repo] = GITHUB_REPOSITORY.split('/')
if (!owner || !repo) throw new Error('Invalid GitHub repository.')
const plan = releasePlan(RELEASE_INCREMENT)
const github = await GitHub.create({
  owner,
  repo,
  token: GH_TOKEN,
  defaultBranch: GITHUB_REF_NAME,
})
// Use Release Please's manifest strategy, with a per-run version override. Never commit a sticky release-as.
// The reachable baseline excludes unrelated main-branch changes from maintenance release notes.
const manifest = await Manifest.fromManifest(
  github,
  GITHUB_REF_NAME,
  'release-please-config.json',
  '.release-please-manifest.json',
  {
    lastReleaseSha: plan.previousSha,
    bootstrapSha: plan.previousSha,
    alwaysUpdate: true,
  },
  undefined,
  plan.version,
)
manifest.releasedVersions['.'] = Version.parse(plan.previousTag.slice(1))
const prs = (await manifest.createPullRequests()).filter(
  (pr) => pr !== undefined,
)
if (prs.length !== 1 || !prs[0])
  throw new Error(
    'Release Please must create exactly one release pull request.',
  )
output('pr', String(prs[0].number))
output('branch', prs[0].headBranchName)
output('version', plan.version)
output('previous_tag', plan.previousTag)
