const packageIntros = {
  'react-native-nitro-sqlite': `\`open({ name })\` returns a connection with query, transaction, and cleanup methods. This reference lists the package's exported functions, objects, and types.

Start with [Getting Started](/docs) for installation and a first query. Use [Configuration](/docs/configuration) for shared \`package.json\` settings, [database lifecycle](/docs/guides/database-lifecycle) for opening and closing connections, and [parameters and results](/docs/guides/parameters-and-results) for queries and errors. For the Node-only test export, see [Test SQLite in Node](/docs/guides/node-test-mock).
`,
  'react-native-nitro-sqlite/mock': `Import \`react-native-nitro-sqlite/mock\` to run SQLite tests through \`better-sqlite3\` without loading the React Native module. See [Test SQLite in Node](/docs/guides/node-test-mock) for installation, Jest setup, shared connections, prepared statements, transactions, and cleanup.
`,
  'react-native-nitro-sqlite-vec': `\`createVectorTable()\` creates a vector table, \`knnSearch()\` finds nearby matches, and \`isVecAvailable()\` checks extension availability on an open connection. This optional package adds [sqlite-vec](https://github.com/asg017/sqlite-vec) to Nitro SQLite.

Follow the [vector search guide](/docs/integrations/vector-search) for installation, platform setup, and a complete example. The functions and types below describe the helper API.
`,
}

export function addPackageIntro(packageName, contents) {
  const intro = packageIntros[packageName]
  if (!intro) return contents

  const heading = `# ${packageName}\n\n`
  if (!contents.includes(heading)) {
    throw new Error(`Missing generated heading for ${packageName}`)
  }

  return contents.replace(heading, `${heading}${intro}\n`)
}
