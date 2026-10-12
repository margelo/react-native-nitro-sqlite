import {
  github,
  git,
  output,
  parseVersion,
  validateReleaseVersions,
} from './release-plan.ts'
import { distributionTag } from './release-registry.ts'

const tag = process.env.RELEASE_TAG
if (!tag?.startsWith('v')) throw new Error('A release tag is required.')
const version = tag.slice(1)
parseVersion(version)
validateReleaseVersions(version)
const release = github(
  'release',
  'view',
  tag,
  '--json',
  'tagName,isDraft',
  '--jq',
  '.',
)
if (
  !release ||
  typeof release !== 'object' ||
  !('tagName' in release) ||
  release.tagName !== tag
) {
  throw new Error('The selected tag must have a GitHub release.')
}
if (git('rev-list', '-n', '1', tag) !== git('rev-parse', 'HEAD'))
  throw new Error('Release tag does not match HEAD.')
// A retry must belong to the branch selected in Run workflow, including arbitrary release branches.
git('merge-base', '--is-ancestor', tag, `origin/${process.env.GITHUB_REF_NAME}`)
output('tag', tag)
output('latest', String((await distributionTag(version)) === 'latest'))
