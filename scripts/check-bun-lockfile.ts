import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]

checkLockfile()

function checkLockfile(): void {
  const manifest = readManifest('package.json')
  const lockfile = readLockfile()
  const lockWorkspaces = requireRecord(
    lockfile.workspaces,
    'bun.lock workspaces',
  )
  const expectedPaths = new Set(['', ...getWorkspacePaths(manifest)])
  const errors: string[] = []

  for (const path of expectedPaths) {
    const label = path || 'root'
    const workspace = requireRecord(
      lockWorkspaces[path],
      `bun.lock workspace ${label}`,
    )
    const workspaceManifest = path
      ? readManifest(join(path, 'package.json'))
      : manifest

    compareField({
      errors,
      label,
      field: 'name',
      manifest: workspaceManifest,
      workspace,
    })
    if (path) {
      compareField({
        errors,
        label,
        field: 'version',
        manifest: workspaceManifest,
        workspace,
      })
    }

    for (const field of dependencyFields) {
      const manifestDependencies = readDependencies(
        workspaceManifest[field],
        `${label} ${field}`,
      )
      const lockedDependencies = readDependencies(
        workspace[field],
        `bun.lock ${label} ${field}`,
      )
      const names = new Set([
        ...Object.keys(manifestDependencies),
        ...Object.keys(lockedDependencies),
      ])

      for (const name of names) {
        if (manifestDependencies[name] !== lockedDependencies[name]) {
          errors.push(
            `${label} ${field}.${name}: manifest=${manifestDependencies[name] ?? 'missing'}, lock=${lockedDependencies[name] ?? 'missing'}`,
          )
        }
      }
    }
  }

  for (const path of Object.keys(lockWorkspaces)) {
    if (!expectedPaths.has(path)) {
      errors.push(`bun.lock has an unexpected workspace: ${path}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `bun.lock does not match the workspace manifests:\n${errors.join('\n')}`,
    )
  }
}

function compareField({
  errors,
  label,
  field,
  manifest,
  workspace,
}: {
  errors: string[]
  label: string
  field: string
  manifest: Record<string, unknown>
  workspace: Record<string, unknown>
}): void {
  if (manifest[field] !== workspace[field]) {
    errors.push(
      `${label} ${field}: manifest=${String(manifest[field])}, lock=${String(workspace[field])}`,
    )
  }
}

function getWorkspacePaths(manifest: Record<string, unknown>): string[] {
  const patterns = manifest.workspaces
  if (!Array.isArray(patterns)) {
    throw new Error('package.json workspaces must be a list of paths')
  }

  const workspacePatterns: string[] = []
  for (const pattern of patterns) {
    if (typeof pattern !== 'string') {
      throw new Error('package.json workspaces must be a list of paths')
    }
    workspacePatterns.push(pattern)
  }

  return workspacePatterns.flatMap((pattern) => {
    if (!pattern.includes('*')) {
      return [pattern]
    }
    if (!pattern.endsWith('/*') || pattern.slice(0, -2).includes('*')) {
      throw new Error(`Unsupported workspace pattern: ${pattern}`)
    }

    const parent = pattern.slice(0, -2)
    return readdirSync(join(root, parent), { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          existsSync(join(root, parent, entry.name, 'package.json')),
      )
      .map((entry) => join(parent, entry.name))
  })
}

function readManifest(path: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(join(root, path), 'utf8'))
  return requireRecord(value, path)
}

function readLockfile(): Record<string, unknown> {
  const { config, error } = ts.parseConfigFileTextToJson(
    'bun.lock',
    readFileSync(join(root, 'bun.lock'), 'utf8'),
  )
  if (error) {
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'))
  }
  return requireRecord(config, 'bun.lock')
}

function readDependencies(
  value: unknown,
  label: string,
): Record<string, string> {
  if (value === undefined) {
    return {}
  }

  const dependencies = requireRecord(value, label)
  const versions: Record<string, string> = {}
  for (const [name, version] of Object.entries(dependencies)) {
    if (typeof version !== 'string') {
      throw new Error(`${label}.${name} must be a string`)
    }
    versions[name] = version
  }
  return versions
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
