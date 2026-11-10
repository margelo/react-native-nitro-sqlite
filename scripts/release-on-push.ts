import { GitHub, Manifest } from 'release-please'
import { output } from './release-plan.ts'

const { GH_TOKEN, GITHUB_REPOSITORY, GITHUB_REF_NAME } = process.env
if (!GH_TOKEN || !GITHUB_REPOSITORY || !GITHUB_REF_NAME) {
  throw new Error('Release token, repository and branch are required.')
}
const [owner, repo] = GITHUB_REPOSITORY.split('/')
if (!owner || !repo) throw new Error('Invalid GitHub repository.')
const github = await GitHub.create({
  owner,
  repo,
  token: GH_TOKEN,
  defaultBranch: GITHUB_REF_NAME,
})
const manifest = () =>
  Manifest.fromManifest(
    github,
    GITHUB_REF_NAME,
    'release-please-config.json',
    '.release-please-manifest.json',
  )

// A merged release PR becomes a draft release and tag first, as release-please-action does.
// Later runs still pick up a merged PR whose run was cancelled, because its label stays pending.
const [release] = (await (await manifest()).createReleases()).filter(
  (release) => release !== undefined,
)
if (release) output('tag', release.tagName)

// Conventional commits since the last release decide the patch, minor or major bump.
const [pr] = (await (await manifest()).createPullRequests()).filter(
  (pr) => pr !== undefined,
)
if (pr) output('branch', pr.headBranchName)
