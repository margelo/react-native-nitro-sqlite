import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

export const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]

export function getWorkspacePaths(
  root: string,
  manifest: Record<string, unknown>,
): string[] {
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

export function readManifest(
  root: string,
  path: string,
): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(join(root, path), 'utf8'))
  return requireRecord(value, path)
}

export function readLockfile(root: string): Record<string, unknown> {
  const { config, error } = ts.parseConfigFileTextToJson(
    'bun.lock',
    readFileSync(join(root, 'bun.lock'), 'utf8'),
  )
  if (error) {
    throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'))
  }
  return requireRecord(config, 'bun.lock')
}

export function readDependencies(
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

export function requireRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
