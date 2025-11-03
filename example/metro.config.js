const fs = require('fs');
const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
// const exclusionList = require('metro-config/src/defaults/exclusionList');
// const escape = require('escape-string-regexp');
const pak = require('../package.json')

const root = path.resolve(__dirname, '..');
const rootNodeModulesPath = path.join(root, 'node_modules');
const exampleNodeModulesPath = path.join(__dirname, 'node_modules');

const modules = Object.keys({ ...pak.peerDependencies })

function getPackageNames(nodeModulesPath) {
  if (!fs.existsSync(nodeModulesPath)) {
    return [];
  }

  const allFiles = fs.readdirSync(nodeModulesPath);

  // Filter out only directories (package names)
  const packageNames = allFiles.filter(file => {
    const filePath = path.join(nodeModulesPath, file);
    return fs.statSync(filePath).isDirectory();
  });

  // Handle scoped packages (e.g., @scope/package)
  const scopedPackages = packageNames
    .filter(pkg => pkg.startsWith('@'))
    .flatMap(scope => {
      const scopePath = path.join(nodeModulesPath, scope);
      const scopedFiles = fs.readdirSync(scopePath);
      return scopedFiles.map(scopedFile => `${scope}/${scopedFile}`);
    });

  // Return both regular and scoped package names
  return packageNames
    .filter(pkg => !pkg.startsWith('@'))
    .concat(scopedPackages);
}

const exampleNodeModules = getPackageNames(exampleNodeModulesPath);

const config = {
  projectRoot: __dirname,
  watchFolders: [root],

  // We need to make sure that only one version is loaded for peerDependencies
  // So we blacklist them at the root, and alias them to the versions in example's node_modules
  resolver: {
    // unstable_enableSymlinks: true,
    // blockList: exclusionList(
    //   exampleNodeModules.map(
    //     m => new RegExp(`^${escape(path.join(rootNodeModulesPath, m))}\\/.*$`),
    //   ),
    // ),

    extraNodeModules: modules.reduce((acc, name) => {
      acc[name] = path.join(__dirname, 'node_modules', name)
      return acc
    }, {}),
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
