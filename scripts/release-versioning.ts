import { registerVersioningStrategy } from 'release-please'
import type { ConventionalCommit } from 'release-please/build/src/commit.js'
import type { Version } from 'release-please/build/src/version.js'
import {
  MajorVersionUpdate,
  MinorVersionUpdate,
  type VersionUpdater,
} from 'release-please/build/src/versioning-strategy.js'
import { DefaultVersioningStrategy } from 'release-please/build/src/versioning-strategies/default.js'

/** Release Please versioning that proposes a minor release where conventional commits call for a major one.
 * Features and breaking changes bump the minor version, other releasable commits bump the patch version,
 * and a `Release-As: x.y.z` commit footer still sets an exact version, including a new major.
 */
export class BreakingAsMinorVersioningStrategy extends DefaultVersioningStrategy {
  override determineReleaseType(
    version: Version,
    commits: ConventionalCommit[],
  ): VersionUpdater {
    const update = super.determineReleaseType(version, commits)
    return update instanceof MajorVersionUpdate
      ? new MinorVersionUpdate()
      : update
  }
}

// Every script that loads release-please-config.json must import this module before reading the manifest.
registerVersioningStrategy(
  'breaking-as-minor',
  (options) => new BreakingAsMinorVersioningStrategy(options),
)
