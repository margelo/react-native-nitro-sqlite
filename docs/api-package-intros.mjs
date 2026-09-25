const packageIntros = {
  'react-native-nitro-sqlite': `Nitro SQLite provides local SQLite databases for React Native. This page lists the package's exported functions, objects, and types. For a guided introduction, start with [Getting Started](/docs).

## Install

Requires React Native 0.75 or newer, React 17 or newer, and \`react-native-nitro-modules\` 0.37.1 or newer.

\`\`\`sh
npm install react-native-nitro-sqlite react-native-nitro-modules
\`\`\`

Install CocoaPods for Apple platforms, then rebuild the native app. Android needs no additional setup for the default database location. Expo projects need a development build; Expo Go cannot load the native module.

\`\`\`sh
npx pod-install
\`\`\`

For a React Native macOS app, run \`pod install\` from its \`macos\` directory. See the [macOS configuration guide](/docs/configuration/macos) for the desktop example and database location.

## Open a database

\`\`\`ts
import { open } from 'react-native-nitro-sqlite'

const db = open({ name: 'app.sqlite' })
db.execute('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT)')
db.execute('INSERT INTO notes (body) VALUES (?)', ['Hello'])
const { rows } = db.execute('SELECT id, body FROM notes')
console.log(rows._array)
db.close()
\`\`\`

Use [Getting Started](/docs) for native setup and a fuller first query. The [concepts](/docs/concepts/databases-and-connections) and [guides](/docs/guides/parameters-and-results) explain database lifetime, query parameters, and results.
`,
  'react-native-nitro-sqlite-vec': `This optional package adds [sqlite-vec](https://github.com/asg017/sqlite-vec) vector search to Nitro SQLite. Its native code is compiled into the core package's SQLite build. The functions and types below cover availability checks, vector tables, and nearest-neighbor searches.

## Install

Install Nitro SQLite, Nitro Modules, and the vector companion. The core requires React Native 0.75 or newer, React 17 or newer, and Nitro Modules 0.37.1 or newer. Enable sqlite-vec for every platform you ship.

\`\`\`sh
npm install react-native-nitro-sqlite react-native-nitro-modules react-native-nitro-sqlite-vec
\`\`\`

On iOS and visionOS, install Pods with the build flag:

\`\`\`sh
NITRO_SQLITE_VEC=1 npx pod-install
\`\`\`

For macOS, run \`NITRO_SQLITE_VEC=1 pod install\` from the app's \`macos\` directory.

On Android, add this to \`android/gradle.properties\`:

\`\`\`properties
nitroSqliteVec=true
\`\`\`

Rebuild the native app after enabling the flag. See the [vector search guide](/docs/integrations/vector-search) for platform setup and usage.

## Create and search a vector table

\`\`\`ts
import { open } from 'react-native-nitro-sqlite'
import {
  createVectorTable,
  isVecAvailable,
  knnSearch,
} from 'react-native-nitro-sqlite-vec'

const db = open({ name: 'vectors.sqlite' })

if (!isVecAvailable(db)) {
  db.close()
  throw new Error('Enable sqlite-vec in the native build')
}

createVectorTable(db, 'embeddings', { dimensions: 3 })
db.execute('INSERT INTO embeddings (rowid, embedding) VALUES (?, ?)', [
  1,
  '[0.1, 0.2, 0.3]',
])

const matches = knnSearch(db, 'embeddings', [0.1, 0.2, 0.25], 10)
console.log(matches)
db.close()
\`\`\`

\`isVecAvailable()\` returns \`false\` when its version query fails. The helpers use table and column names as SQL identifiers, so only pass names you control. See the [vector search guide](/docs/integrations/vector-search) for storage types, distance metrics, and custom queries.
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
