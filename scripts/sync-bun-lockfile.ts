import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyEdits, modify, parse, type ParseError } from 'jsonc-parser'
import {
  dependencyFields,
  getWorkspacePaths,
  readDependencies,
  readManifest,
  requireRecord,
} from './bun-lockfile-workspaces'

syncLockfile(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)))

function syncLockfile(root: string): void {
  const lockfilePath = join(root, 'bun.lock')
  let content = readFileSync(lockfilePath, 'utf8')
  const originalContent = content
  const parseErrors: ParseError[] = []
  const parsed: unknown = parse(content, parseErrors, {
    allowTrailingComma: true,
  })
  if (parseErrors.length > 0) {
    throw new Error('Cannot synchronize an invalid bun.lock')
  }

  const workspaces = requireRecord(
    requireRecord(parsed, 'bun.lock').workspaces,
    'bun.lock workspaces',
  )
  const rootManifest = readManifest(root, 'package.json')
  const paths = ['', ...getWorkspacePaths(root, rootManifest)]
  const manifests = new Map(
    paths.map((path) => [
      path,
      path ? readManifest(root, `${path}/package.json`) : rootManifest,
    ]),
  )
  const workspaceNames = new Set<string>()
  for (const path of paths) {
    if (!path) {
      continue
    }
    const name = requireRecord(manifests.get(path), path).name
    if (typeof name !== 'string') {
      throw new Error(`${path} name must be a string`)
    }
    workspaceNames.add(name)
  }

  for (const path of paths) {
    const label = path || 'root'
    const workspace = requireRecord(
      workspaces[path],
      `bun.lock workspace ${label}`,
    )
    const manifest = requireRecord(manifests.get(path), `${label} manifest`)

    if (path) {
      update(
        ['workspaces', path, 'version'],
        workspace.version,
        manifest.version,
      )
    }

    for (const field of dependencyFields) {
      const locked = readDependencies(
        workspace[field],
        `bun.lock ${label} ${field}`,
      )
      const expected = readDependencies(manifest[field], `${label} ${field}`)
      const names = new Set([...Object.keys(locked), ...Object.keys(expected)])

      for (const name of names) {
        if (!workspaceNames.has(name)) {
          continue
        }
        update(['workspaces', path, field, name], locked[name], expected[name])
      }
    }
  }

  if (content !== originalContent) {
    writeFileSync(lockfilePath, content)
  }

  function update(path: string[], current: unknown, expected: unknown): void {
    if (current === expected) {
      return
    }
    if (expected !== undefined && typeof expected !== 'string') {
      throw new Error(`${path.join('.')} must be a string`)
    }

    content = applyEdits(
      content,
      modify(content, path, expected, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      }),
    )
  }
}
