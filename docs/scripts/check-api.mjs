import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const api = JSON.parse(
  readFileSync(
    new URL('../content/api-reflection.json', import.meta.url),
    'utf8',
  ),
)

const requiredExports = {
  'react-native-nitro-sqlite': [
    'open',
    'NitroSQLite',
    'NitroSQLiteConnection',
    'NitroSQLiteConnectionOptions',
    'QueryResult',
    'Transaction',
    'BatchQueryCommand',
    'NitroSQLiteError',
    'NitroSQLiteExceptionType',
    'NitroSQLiteNative',
    'NitroSQLiteQueryResult',
    'NitroSQLiteQueryColumnMetadata',
    'TypeOrmNitroSQLiteConnection',
    'typeORMDriver',
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
      'close',
      'drop',
      'attach',
      'detach',
      'loadFile',
      'loadFileAsync',
    ],
    NitroSQLiteConnection: [
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
    Transaction: ['commit', 'rollback', 'execute', 'executeAsync'],
    NitroSQLiteError: ['type', 'fromError'],
    NitroSQLiteNative: [
      'open',
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
    NitroSQLiteQueryResult: ['rowsAffected', 'insertId', 'results', 'metadata'],
    NitroSQLiteQueryColumnMetadata: ['name', 'type', 'index'],
    TypeOrmNitroSQLiteConnection: [
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

console.log(
  `Checked ${Object.values(requiredExports).flat().length} exports and ${pages.length} API pages.`,
)
