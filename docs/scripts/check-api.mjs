import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const api = JSON.parse(
  readFileSync(
    new URL('../content/api-reflection.json', import.meta.url),
    'utf8',
  ),
)

const deprecatedExports = [
  'NitroSQLiteConnection',
  'NitroSQLiteConnectionOptions',
  'NitroSQLiteQueryResultRows',
  'NitroSQLiteQueryColumnMetadata',
  'NitroSQLiteQueryResult',
  'NitroSQLiteQueryRows',
  'NitroSQLitePreparedStatement',
  'NitroSQLiteNative',
  'NitroSQLiteError',
  'NitroSQLiteExceptionType',
  'TypeOrmNitroSQLiteConnection',
]

const requiredExports = {
  'react-native-nitro-sqlite': [
    'open',
    'NitroSQLite',
    'Connection',
    'ConnectionOptions',
    'QueryResult',
    'Transaction',
    'BatchQueryCommand',
    'SQLiteError',
    'SQLiteExceptionType',
    'NativeSQLite',
    'NativePreparedStatement',
    'NativeQueryResult',
    'NativeQueryRows',
    'QueryResultRows',
    'QueryColumnMetadata',
    'TypeOrmConnection',
    'typeORMDriver',
    ...deprecatedExports,
  ],
  'react-native-nitro-sqlite/mock': [
    'open',
    'NitroSQLite',
    'MockConnection',
    'resetAllDatabases',
  ],
  'react-native-nitro-sqlite-vec': [
    'VectorColumnType',
    'VectorDistanceMetric',
    'KnnMatch',
    'CreateVectorTableOptions',
    'KnnSearchOptions',
    'vecVersion',
    'isVecAvailable',
    'createVectorTable',
    'knnSearch',
  ],
}

for (const [packageName, exports] of Object.entries(requiredExports)) {
  const packageReflection = api.children?.find(
    (child) => child.name === packageName,
  )
  assert.ok(packageReflection, `Missing API package: ${packageName}`)

  for (const name of exports) {
    assert.ok(
      packageReflection.children?.some((symbol) => symbol.name === name),
      `Missing API export: ${packageName}.${name}`,
    )
  }
}

const requiredMembers = {
  'react-native-nitro-sqlite': {
    NitroSQLite: [
      'native',
      'open',
      'transaction',
      'execute',
      'executeAsync',
      'executeBatch',
      'executeBatchAsync',
    ],
    Connection: [
      'close',
      'delete',
      'attach',
      'detach',
      'transaction',
      'execute',
      'executeAsync',
      'executeBatch',
      'executeBatchAsync',
      'loadFile',
      'loadFileAsync',
    ],
    ConnectionOptions: ['encryptionKey'],
    Transaction: ['commit', 'rollback', 'execute', 'executeAsync'],
    SQLiteError: ['type', 'fromError'],
    NativeSQLite: [
      'open',
      'openConnection',
      'close',
      'drop',
      'attach',
      'detach',
      'execute',
      'executeAsync',
      'executeBatch',
      'executeBatchAsync',
      'loadFile',
      'loadFileAsync',
    ],
    NativeQueryResult: ['rowsAffected', 'insertId', 'results', 'metadata'],
    QueryColumnMetadata: ['name', 'type', 'index'],
    TypeOrmConnection: [
      'executeSql',
      'transaction',
      'close',
      'attach',
      'detach',
    ],
    typeORMDriver: ['openDatabase'],
  },
  'react-native-nitro-sqlite-vec': {
    CreateVectorTableOptions: [
      'dimensions',
      'type',
      'distanceMetric',
      'column',
    ],
    KnnSearchOptions: ['column'],
    KnnMatch: ['rowid', 'distance'],
  },
}

for (const [packageName, symbols] of Object.entries(requiredMembers)) {
  const packageReflection = api.children.find(
    (child) => child.name === packageName,
  )
  for (const [name, members] of Object.entries(symbols)) {
    const symbol = packageReflection.children.find(
      (child) => child.name === name,
    )
    const actual = symbol?.type?.declaration?.children ?? symbol?.children ?? []

    for (const member of members) {
      assert.ok(
        actual.some((child) => child.name === member),
        `Missing API member: ${packageName}.${name}.${member}`,
      )
    }
  }
}

const output = new URL('../content/api/', import.meta.url)
const pages = readdirSync(output, { recursive: true }).filter((path) =>
  path.endsWith('.mdx'),
)
assert.ok(pages.length > 0, 'No API MDX pages were generated')
const pagePaths = new Set(pages)

for (const page of pages) {
  const content = readFileSync(new URL(page, output), 'utf8')
  assert.match(
    content,
    /^---\ntitle: .+\n(?:description: .+\n)?---\n/,
    `Missing title frontmatter: ${page}`,
  )
  assert.doesNotMatch(
    content,
    /\]\([^)]*\.mdx(?:#[^)]*)?\)/,
    `Broken MDX link: ${page}`,
  )
  assert.doesNotMatch(
    content,
    /^\[API Reference\]\(\/api\) \/ /m,
    `Duplicate TypeDoc breadcrumb: ${page}`,
  )
  if (!page.endsWith('index.mdx')) {
    assert.match(
      content,
      /^<ApiSymbolHeader title=".+" languages="(?:TypeScript|JavaScript|C\+\+|C|Kotlin|Swift)(?:,(?:TypeScript|JavaScript|C\+\+|C|Kotlin|Swift))*" \/>$/m,
      `Missing language badges in heading: ${page}`,
    )
    assert.match(
      content,
      /\*\*Source files:\*\* \[(?:TypeScript|JavaScript|C\+\+|C|Kotlin|Swift)\]\(https:\/\/github\.com\/margelo\/react-native-nitro-sqlite\/blob\/[^)]+\)/,
      `Missing language-labeled source link: ${page}`,
    )
    assert.match(
      content,
      /<div className="api-signature">/,
      `Missing formatted API signature: ${page}`,
    )
  }

  const route = page.endsWith('index.mdx')
    ? `/api/${page.slice(0, -'/index.mdx'.length)}`.replace(/\/$/, '')
    : `/api/${page.slice(0, -4)}`
  for (const [, href] of content.matchAll(/\]\(([^)\s]+)\)/g)) {
    const link = new URL(href, `https://docs.example${route}`)
    if (link.origin !== 'https://docs.example') continue
    if (link.pathname !== '/api' && !link.pathname.startsWith('/api/')) continue

    const target = link.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '')
    assert.ok(
      !target.endsWith('/index') && target !== 'index',
      `Broken index route in ${page}: ${href}`,
    )
    const targetPage = !target
      ? 'index.mdx'
      : pagePaths.has(`${target}/index.mdx`)
        ? `${target}/index.mdx`
        : `${target}.mdx`
    assert.ok(
      pagePaths.has(targetPage),
      `Missing API link target in ${page}: ${href}`,
    )

    if (link.hash) {
      const targetContent = readFileSync(new URL(targetPage, output), 'utf8')
      const headings = [...targetContent.matchAll(/^#{1,6}\s+(.+)$/gm)]
      const fragment = decodeURIComponent(link.hash.slice(1))
      assert.ok(
        headings.some(
          ([, heading]) =>
            heading
              .toLowerCase()
              .replace(/[^\p{L}\p{N}\s-]/gu, '')
              .replace(/\s+/g, '-') === fragment,
        ),
        `Missing API link heading in ${page}: ${href}`,
      )
    }
  }
}

const corePackageHome = readFileSync(
  new URL('react-native-nitro-sqlite/index.mdx', output),
  'utf8',
)
const corePackage = api.children.find(
  (child) => child.name === 'react-native-nitro-sqlite',
)
for (const name of deprecatedExports) {
  const alias = corePackage.children.find((child) => child.name === name)
  const deprecated = alias.comment?.blockTags?.find(
    (tag) => tag.tag === '@deprecated',
  )
  assert.ok(deprecated, `Missing deprecation comment: ${name}`)
  const target = corePackage.children.find((child) => child.id === alias.target)
  assert.ok(target, `Missing reference target: ${name}`)
  // A canonical type and value can have separate reflection IDs with the same name.
  const canonicalExports = corePackage.children.filter(
    (child) => child.name === target.name,
  )
  assert.ok(
    deprecated.content.some((part) =>
      canonicalExports.some((child) => child.id === part.target),
    ),
    `Missing canonical replacement link: ${name}`,
  )
  for (const canonical of canonicalExports) {
    assert.ok(
      !canonical.comment?.blockTags?.some((tag) => tag.tag === '@deprecated'),
      `Canonical export is deprecated: ${canonical.name}`,
    )
  }
  const section = corePackageHome
    .split(`### ~~${name}~~\n`)[1]
    ?.split(/\n(?:#{1,3} |\*\*\*)/)[0]
  assert.ok(section, `Missing reference section: ${name}`)
  assert.match(
    section,
    /\*\*Deprecated\*\*/,
    `Missing rendered deprecation: ${name}`,
  )
  assert.ok(
    section.includes(
      `Use [\`${target.name}\`](/api/react-native-nitro-sqlite/`,
    ),
    `Missing rendered replacement link: ${name}`,
  )
}
assert.ok(
  corePackageHome.indexOf('## Hybrid Objects') <
    corePackageHome.indexOf('## Classes'),
  'Hybrid Objects must appear before other API groups',
)
for (const name of ['NativeSQLite']) {
  assert.ok(
    pagePaths.has(`react-native-nitro-sqlite/hybrid-objects/${name}.mdx`),
    `Missing Hybrid Object page: ${name}`,
  )
}

console.log(
  `Checked ${Object.values(requiredExports).flat().length} exports and ${pages.length} API pages.`,
)
