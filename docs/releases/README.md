# Releasing NitroSQLite

Open the **Release** workflow in GitHub Actions, select **Run workflow**, and choose the branch containing the changes to release. The same flow supports main and any maintenance or release branch that contains the release automation.

Set **version** to `patch`, `minor`, `major`, or an exact stable version. The workflow resolves the version from the selected branch and existing tags. Both packages, the workspace, and the example keep the same version. Existing patch tags from the same version line prevent accidental reuse across sibling branches.

The workflow creates or updates a Release Please PR against that branch, regenerates the workspace and CocoaPods lockfiles, and commits the generated files through GitHub's signed commit API. It waits for the usual PR checks and merges when GitHub permits the merge. Required reviews and branch protection still apply. No manually prepared version commit or separate publishing trigger is needed.

After merging, Release Please creates a draft release and its tag at the merge commit. The workflow validates and builds both packages, checks both npm trusted publishers, and publishes with provenance. It attaches the Android example APK before publishing the GitHub announcement.

## Announcements and changelog

Supply **announcement** when starting the workflow, or commit `docs/releases/vX.Y.Z.md` on the selected branch beforehand. The workflow saves supplied text in that versioned file. If neither exists, it supplies a short version announcement.

Every release includes the announcement, a Markdown divider, and the current version's complete Release Please changelog. The existing changelog groups are retained. GitHub detects first-time contributors using the previous reachable release tag and the exact release commit. The release includes a new contributors section only when contributors are detected.

## Maintenance channels

Version 9 releases use the npm `legacy-9` channel and never become GitHub's latest release. Other versions use `latest` unless a newer version is already published. Older maintenance versions use `maintenance-MAJOR.MINOR` instead, and do not move GitHub's latest release backwards.

## Credentials

Configure a `RELEASE_PLEASE_TOKEN` repository secret with a fine-grained personal access token that can write repository contents, pull requests, and issues. Include workflows write access for release branches whose workflows differ from the default branch. The token must be allowed to create and merge release PRs subject to the repository's normal rules. A token separate from the workflow's built-in token makes automated commits trigger the usual CI checks.

During migration, the existing `RELEASE_IT_GITHUB_TOKEN` secret is accepted as a fallback with the same permissions. No npm publishing token is needed. Both npm packages retain their trusted publisher for `margelo/react-native-nitro-sqlite`, workflow `release.yml`, with no environment.

## Recovering a failed release

Use GitHub's **Re-run failed jobs** to continue the same release after fixing a transient failure or completing required reviews. If a tag and draft already exist, start the Release workflow on the same branch with **release_tag** set to `vX.Y.Z`. This skips the version bump and release PR.

Publication retries skip a package only when the existing npm version records the same Git commit. The workflow refuses a version published from another commit. An APK failure leaves the GitHub release as a draft; retrying attaches the APK and publishes the assembled notes without another version bump.

The migration must be merged or cherry-picked onto an older maintenance branch before running this workflow there. The workflow selects its baseline at runtime, so no branch-specific Release Please configuration is needed.
