#!/usr/bin/env bash

set -euo pipefail

echo "Starting the release process..."
echo "Provided options: $*"

release_it_args=("$@")
forward_args=()
package_args=()
skip_next=false

if [ "$#" -gt 0 ]; then
  case "$1" in
    major|minor|patch|premajor|preminor|prepatch|prerelease|v[0-9]*|[0-9]*)
      release_it_args_without_increment=("${release_it_args[@]:1}")
      ;;
    *)
      release_it_args_without_increment=("${release_it_args[@]}")
      ;;
  esac
else
  release_it_args_without_increment=()
fi

for arg in "${release_it_args_without_increment[@]}"; do
  if [ "$skip_next" = true ]; then
    skip_next=false
    continue
  fi

  case "$arg" in
    --increment|-i)
      skip_next=true
      ;;
    --increment=*|-i=*)
      ;;
    *)
      forward_args+=("$arg")
      case "$arg" in
        --git*|--no-git*|--github*|--no-github*)
          ;;
        *)
          package_args+=("$arg")
          ;;
      esac
      ;;
  esac
done

release_version_output="$(bun run release-it "${release_it_args[@]}" --release-version)"
release_version="$(printf '%s\n' "$release_version_output" | tail -n 1)"

if [[ ! "$release_version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  echo "$release_version_output"
  echo "Could not resolve a valid release version." >&2
  exit 1
fi

echo "Resolved release version: $release_version"

echo "Publishing react-native-nitro-sqlite@$release_version to NPM"
cd packages/react-native-nitro-sqlite
bun release "$release_version" "${package_args[@]}"

echo "Publishing react-native-nitro-sqlite-vec@$release_version to NPM"
cd ../react-native-nitro-sqlite-vec
bun release "$release_version" "${package_args[@]}"

echo "Creating a Git bump commit and GitHub release"

cd ../..

bun run release-it "$release_version" "${forward_args[@]}"

echo "Successfully released react-native-nitro-sqlite and react-native-nitro-sqlite-vec!"
