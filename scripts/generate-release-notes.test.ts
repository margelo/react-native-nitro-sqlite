import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

type Configuration = {
  'repository': { type: string; url: string }
  'release-it': {
    plugins: {
      '@release-it/conventional-changelog': {
        preset: { types: { type: string; section: string }[] }
      }
    }
  }
}

const script = fileURLToPath(
  new URL('./generate-release-notes.ts', import.meta.url),
)
const configuration = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Configuration

test('combines the announcement, configured changelog, and new contributors from the selected release branch', () => {
  const githubNotes =
    "## What's Changed\n* unrelated generated list\n\n## New Contributors\n* @newcomer made their first contribution in https://github.com/margelo/react-native-nitro-sqlite/pull/1\n\n**Full Changelog**: contributor-section-end"
  withFixture(githubNotes, (directory) => {
    const notes = generate(directory)
    assert.match(notes, /^Custom announcement\.\n\n---\n\n/)
    const fixSection = configuration['release-it'].plugins[
      '@release-it/conventional-changelog'
    ].preset.types.find((entry) => entry.type === 'fix')?.section
    assert.ok(fixSection)
    assert.ok(notes.includes(fixSection))
    assert.match(notes, /repair runtime connections/)
    assert.match(notes, /v1\.0\.0\.\.\.v1\.0\.1/)
    assert.match(
      notes,
      /## New Contributors\n\* @newcomer made their first contribution in https:\/\/github\.com\/margelo\/react-native-nitro-sqlite\/pull\/1/,
    )
    assert.doesNotMatch(
      notes,
      /main only feature|initial release fixture|unrelated generated list|contributor-section-end/,
    )
  })
})

test('regenerates a published release from its previous tag and omits the section when there are no new contributors', () => {
  withFixture("## What's Changed\n* existing contributor", (directory) => {
    git(directory, 'tag', 'v1.0.1')
    const notes = generate(directory)
    assert.match(notes, /repair runtime connections/)
    assert.match(notes, /v1\.0\.0\.\.\.v1\.0\.1/)
    assert.doesNotMatch(notes, /New Contributors|No new contributors/)
  })
})

test('rejects a release increment before generating notes', () => {
  withFixture('', (directory) => {
    assert.throws(
      () => generate(directory, 'patch'),
      /An exact stable release version is required/,
    )
  })
})

function generate(directory: string, version = '1.0.1'): string {
  const destination = join(directory, 'notes.md')
  execFileSync(process.execPath, [script, version, destination], {
    cwd: directory,
    env: {
      ...process.env,
      PATH: `${join(directory, 'bin')}:${process.env.PATH}`,
    },
    stdio: 'pipe',
  })
  return readFileSync(destination, 'utf8')
}

function withFixture(body: string, run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'nitrosqlite-release-notes-'))
  try {
    git(directory, 'init', '-b', 'main')
    git(directory, 'config', 'user.name', 'Christoph Pader')
    git(directory, 'config', 'user.email', 'release-test@example.invalid')
    // Fixture commits stay inside this temporary repository and need no signing key in CI.
    git(directory, 'config', 'commit.gpgsign', 'false')
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({
        'name': 'release-notes-fixture',
        'version': '1.0.1',
        'repository': configuration.repository,
        'release-it': configuration['release-it'],
      }),
    )
    mkdirSync(join(directory, 'docs/releases'), { recursive: true })
    writeFileSync(
      join(directory, 'docs/releases/v1.0.1.md'),
      'Custom announcement.\n',
    )
    git(directory, 'add', '.')
    git(directory, 'commit', '-m', 'chore: initial release fixture')
    git(directory, 'tag', 'v1.0.0')
    git(directory, 'branch', 'release/1.0')
    git(directory, 'commit', '--allow-empty', '-m', 'feat: main only feature')
    git(directory, 'switch', 'release/1.0')
    git(
      directory,
      'commit',
      '--allow-empty',
      '-m',
      'fix: repair runtime connections',
    )
    mkdirSync(join(directory, 'bin'))
    writeFileSync(
      join(directory, 'bin/gh'),
      `#!/usr/bin/env node\nconst args = process.argv.slice(2);\nif (!args.includes('previous_tag_name=v1.0.0') || !args.includes('tag_name=v1.0.1')) throw new Error('Incorrect GitHub release range');\nprocess.stdout.write(${JSON.stringify(JSON.stringify({ body }))});\n`,
      { mode: 0o755 },
    )
    run(directory)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function git(directory: string, ...args: string[]): void {
  execFileSync('git', args, { cwd: directory, stdio: 'pipe' })
}
