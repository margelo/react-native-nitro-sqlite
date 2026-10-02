import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import type { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

type RootPackage = {
  'release-it'?: {
    plugins?: Record<string, Record<string, unknown>>
  }
}

type ChangelogFactory = (
  options: Record<string, unknown>,
  context: Record<string, string>,
  commits: Record<string, string>,
) => Readable

/** Build announcement text, the configured commit changelog, and contributor acknowledgements.
 * The range ends at the selected commit and starts at its previous reachable release tag.
 * Throws if custom notes, the changelog configuration, or GitHub contributor detection are unavailable.
 * @param version Exact stable version being released.
 * @returns Complete Markdown announcement and changelog, with acknowledgements when new contributors exist.
 */
export async function generateReleaseNotes(version: string): Promise<string> {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('An exact stable release version is required.')
  }

  const releaseCommit = git('rev-parse', 'HEAD')
  const previousTag = git(
    'describe',
    '--tags',
    '--match',
    'v[0-9]*',
    '--abbrev=0',
    `${releaseCommit}^`,
  )
  const currentTag = `v${version}`
  const announcement = (
    await readFile(`docs/releases/${currentTag}.md`, 'utf8')
  ).trim()
  if (!announcement) throw new Error('Custom release notes must not be empty.')

  const metadata = JSON.parse(
    await readFile('package.json', 'utf8'),
  ) as RootPackage
  const options =
    metadata['release-it']?.plugins?.['@release-it/conventional-changelog']
  if (!options?.preset) {
    throw new Error('The release pipeline must configure a changelog preset.')
  }

  const require = createRequire(import.meta.url)
  const pluginRequire = createRequire(
    require.resolve('@release-it/conventional-changelog/package.json'),
  )
  const changelogFactory = pluginRequire(
    'conventional-changelog',
  ) as ChangelogFactory
  const stream = changelogFactory(
    { ...options, releaseCount: 1, tagPrefix: 'v' },
    { version, previousTag, currentTag },
    { from: previousTag, to: releaseCommit },
  )
  let changelog = ''
  for await (const chunk of stream) changelog += String(chunk)
  if (!changelog.trim())
    throw new Error('The release changelog must not be empty.')

  const githubNotes = JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        'repos/{owner}/{repo}/releases/generate-notes',
        '--method',
        'POST',
        '-f',
        `tag_name=${currentTag}`,
        '-f',
        `target_commitish=${releaseCommit}`,
        '-f',
        `previous_tag_name=${previousTag}`,
      ],
      { encoding: 'utf8' },
    ),
  ) as { body?: string }
  if (typeof githubNotes.body !== 'string') {
    throw new Error('GitHub did not return generated release notes.')
  }

  return `${[
    announcement,
    '---',
    changelog.trim(),
    contributorsSection(githubNotes.body),
  ]
    .filter(Boolean)
    .join('\n\n')}\n`
}

function contributorsSection(notes: string): string {
  const lines = notes.split('\n')
  const start = lines.findIndex((line) => /^## New Contributors\s*$/.test(line))
  if (start === -1) return ''

  const remaining = lines.slice(start + 1)
  const end = remaining.findIndex((line) =>
    /^#{1,2} |^\*\*Full Changelog\*\*/.test(line),
  )
  const contributors = remaining
    .slice(0, end === -1 ? undefined : end)
    .join('\n')
    .trim()
  if (!contributors) return ''

  return `## New Contributors\n${contributors}`
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [version, destination] = process.argv.slice(2)
  if (!version || !destination) {
    throw new Error('Provide the release version and output file.')
  }
  await writeFile(destination, await generateReleaseNotes(version))
}
