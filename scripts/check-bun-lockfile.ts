import { fileURLToPath } from 'node:url'
import {
  dependencyFields,
  getWorkspacePaths,
  readDependencies,
  readLockfile,
  readManifest,
  requireRecord,
} from './bun-lockfile-workspaces'

checkLockfile(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)))

function checkLockfile(root: string): void {
  const manifest = readManifest(root, 'package.json')
  const lockfile = readLockfile(root)
  const lockWorkspaces = requireRecord(
    lockfile.workspaces,
    'bun.lock workspaces',
  )
  const expectedPaths = new Set(['', ...getWorkspacePaths(root, manifest)])
  const errors: string[] = []

  for (const path of expectedPaths) {
    const label = path || 'root'
    const workspace = requireRecord(
      lockWorkspaces[path],
      `bun.lock workspace ${label}`,
    )
    const workspaceManifest = path
      ? readManifest(root, `${path}/package.json`)
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
