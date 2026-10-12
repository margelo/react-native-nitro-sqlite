import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { git, parseVersion } from './release-plan.ts'

/** Assemble announcement text, Release Please's changelog and first-time contributor acknowledgements.
 * Reads the current version's committed changelog without changing its sections or formatting.
 * Contributor detection uses the previous reachable tag and the checked-out release commit.
 * @param version Exact stable version being released.
 * @returns Markdown separated by a divider, with acknowledgements only when GitHub detects newcomers.
 * @throws If the changelog or GitHub contributor detection is unavailable.
 */
export async function generateReleaseNotes(version: string): Promise<string> {
  parseVersion(version)
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
  let announcement: string
  try {
    announcement = (
      await readFile(`docs/releases/${currentTag}.md`, 'utf8')
    ).trim()
    if (!announcement)
      throw new Error('Custom release notes must not be empty.')
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    )
      throw error
    announcement = `NitroSQLite ${version} is available. The changes since ${previousTag} are listed below.`
  }
  const changelog = versionChangelog(
    await readFile('CHANGELOG.md', 'utf8'),
    version,
  )
  const notes: unknown = JSON.parse(
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
  )
  if (
    !notes ||
    typeof notes !== 'object' ||
    !('body' in notes) ||
    typeof notes.body !== 'string'
  ) {
    throw new Error('GitHub did not return generated release notes.')
  }
  return (
    [announcement, '---', changelog, contributorsSection(notes.body)]
      .filter(Boolean)
      .join('\n\n') + '\n'
  )
}

/** Extract one release's generated changelog, preserving its Markdown and omitting older versions.
 * @throws If the selected version has no generated entry.
 */
export function versionChangelog(content: string, version: string): string {
  parseVersion(version)
  const lines = content.split('\n')
  const header = /^## \[?v?(\d+\.\d+\.\d+)(?:\]|\s|$)/
  const start = lines.findIndex((line) => line.match(header)?.[1] === version)
  if (start === -1) throw new Error(`CHANGELOG.md has no entry for ${version}.`)
  const next = lines.findIndex(
    (line, index) => index > start && header.test(line),
  )
  return lines
    .slice(start, next === -1 ? undefined : next)
    .join('\n')
    .trim()
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
  if (!/^\s*[*-] @\S+.*https:\/\/github\.com\//m.test(contributors)) return ''
  return `## New Contributors\n${contributors}`
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [version, destination] = process.argv.slice(2)
  if (!version || !destination)
    throw new Error('Provide the release version and output file.')
  await writeFile(destination, await generateReleaseNotes(version))
}
