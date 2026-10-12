import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { git, parseVersion } from './release-plan.ts'

const branch = process.env.RELEASE_BRANCH
const repository = process.env.GITHUB_REPOSITORY
if (!branch || !repository)
  throw new Error('Release branch and repository are required.')
const paths = [
  'bun.lock',
  'example/ios/Podfile.lock',
  'example/macos/Podfile.lock',
  'example/Gemfile.lock',
]
const announcement = process.env.RELEASE_ANNOUNCEMENT
if (announcement?.trim()) {
  const metadata: unknown = JSON.parse(readFileSync('package.json', 'utf8'))
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !('version' in metadata) ||
    typeof metadata.version !== 'string'
  )
    throw new Error('The workspace must have a release version.')
  const version = metadata.version
  parseVersion(version)
  const path = `docs/releases/v${version}.md`
  writeFileSync(path, announcement.trim() + '\n')
  paths.push(path)
}
const changed = paths.filter((path) => git('status', '--porcelain', '--', path))
if (changed.length) {
  // GitHub signs commits created through this mutation. An expected head prevents racing another run.
  const payload = {
    query:
      'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }',
    variables: {
      input: {
        branch: { repositoryNameWithOwner: repository, branchName: branch },
        expectedHeadOid: git('rev-parse', 'HEAD'),
        message: {
          headline: 'chore: prepare release lockfiles and announcement',
        },
        fileChanges: {
          additions: changed.map((path) => ({
            path,
            contents: readFileSync(path).toString('base64'),
          })),
        },
      },
    },
  }
  execFileSync('gh', ['api', 'graphql', '--input', '-'], {
    input: JSON.stringify(payload),
    stdio: ['pipe', 'inherit', 'inherit'],
  })
}
