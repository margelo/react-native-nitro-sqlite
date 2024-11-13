echo "Starting the release process..."
echo "Provided options: $@"

echo "Publishing react-native-nitro-sqlite to NPM"
cd package
bun release $@

echo "Creating a Git bump commit and GitHub release"
cd ..
bun run release-it $@

echo "Successfully released react-native-nitro-sqlite!"
