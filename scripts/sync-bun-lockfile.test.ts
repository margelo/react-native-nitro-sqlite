import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { parse } from 'jsonc-parser'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))

test('synchronizes stale workspace versions and dependency references', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'nitro-lockfile-'))

  try {
    mkdirSync(join(fixture, 'example'))
    mkdirSync(join(fixture, 'packages', 'core'), { recursive: true })
    mkdirSync(join(fixture, 'packages', 'vec'))
    writeJson('package.json', {
      name: 'workspace',
      workspaces: ['example', 'packages/*'],
    })
    writeJson('example/package.json', {
      name: 'example',
      version: '9.8.2',
      dependencies: { core: '9.8.2', vec: '9.8.2' },
    })
    writeJson('packages/core/package.json', {
      name: 'core',
      version: '9.8.2',
    })
    writeJson('packages/vec/package.json', {
      name: 'vec',
      version: '9.8.2',
      devDependencies: { core: '9.8.2' },
    })
    writeFileSync(
      join(fixture, 'bun.lock'),
      `{
  "workspaces": {
    "": { "name": "workspace" },
    "example": { "name": "example", "version": "9.8.1", "dependencies": { "core": "9.8.1", "vec": "9.8.1" } },
    "packages/core": { "name": "core", "version": "9.8.1" },
    "packages/vec": { "name": "vec", "version": "9.8.1", "devDependencies": { "core": "9.8.1" } },
  },
}
`,
    )

    assert.notEqual(run('check-bun-lockfile.ts').status, 0)
    assert.equal(run('sync-bun-lockfile.ts').status, 0)
    assert.equal(run('check-bun-lockfile.ts').status, 0)

    const synchronized = readFileSync(join(fixture, 'bun.lock'), 'utf8')
    const lockfile = parse(synchronized)
    assert.equal(lockfile.workspaces.example.version, '9.8.2')
    assert.deepEqual(lockfile.workspaces.example.dependencies, {
      core: '9.8.2',
      vec: '9.8.2',
    })
    assert.equal(
      lockfile.workspaces['packages/vec'].devDependencies.core,
      '9.8.2',
    )

    assert.equal(run('sync-bun-lockfile.ts').status, 0)
    assert.equal(readFileSync(join(fixture, 'bun.lock'), 'utf8'), synchronized)

    writeJson('example/package.json', {
      name: 'example',
      version: '9.8.2',
      dependencies: { core: '9.8.2', vec: '9.8.2', external: '2.0.0' },
    })
    assert.equal(run('sync-bun-lockfile.ts').status, 0)
    assert.equal(readFileSync(join(fixture, 'bun.lock'), 'utf8'), synchronized)
    assert.notEqual(run('check-bun-lockfile.ts').status, 0)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }

  function writeJson(path: string, value: object): void {
    writeFileSync(join(fixture, path), JSON.stringify(value))
  }

  function run(script: string): ReturnType<typeof spawnSync> {
    return spawnSync(
      process.execPath,
      [join(projectRoot, 'scripts', script), fixture],
      { encoding: 'utf8' },
    )
  }
})
