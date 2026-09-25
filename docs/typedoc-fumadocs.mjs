import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  MarkdownPageEvent,
  MarkdownRendererEvent,
  MemberRouter,
} from 'typedoc-plugin-markdown'
import { addPackageIntro } from './api-package-intros.mjs'

export function load(app) {
  app.renderer.defineRouter('nitro-member', NitroMemberRouter)

  app.renderer.on(MarkdownPageEvent.BEGIN, (page) => {
    page.frontmatter = { ...page.frontmatter, title: page.model.name }

    if (page.model === page.project) {
      page.frontmatter.description =
        'Generated TypeScript reference for NitroSQLite and its vector search companion.'
    }
  })

  app.renderer.on(MarkdownPageEvent.END, (page) => {
    const contents =
      page.model === page.project
        ? page.contents.replace(
            /\*\*API Reference\*\*\n\n\*\*\*\n\n# API Reference\n\n/,
            'The core package reference covers opening and managing databases, queries, transactions, batches, results, errors, and the TypeORM adapter. The vector package reference covers sqlite-vec availability, vector tables, nearest-neighbor searches, and their option and result types. Each item page shows its TypeScript signature and behavior documented in the source.\n\n',
          )
        : page.contents.replace(
            /\[\*\*API Reference\*\*\]\([^)]+\)\n\n\*\*\*\n\n/,
            '',
          )

    const withIntro = addPackageIntro(page.model.name, contents)
    const withHybridSection = addHybridObjectsSection(withIntro)
    const withSourceHeader = addSourceHeader(page.model, withHybridSection)

    page.contents = withSourceHeader.replace(/\]\(([^)]+)\)/g, (link, href) => {
      if (
        href.startsWith('#') ||
        href.startsWith('/') ||
        /^[a-z][a-z\d+.-]*:/i.test(href)
      ) {
        return link
      }

      const url = new URL(href, `https://docs.example/api/${page.url}`)
      const pathname = url.pathname
        .replace(/\/index\.mdx$/, '')
        .replace(/\.mdx$/, '')
        .replace(/\/$/, '')

      return `](${pathname || '/api'}${url.search}${url.hash})`
    })
  })

  app.renderer.on(MarkdownRendererEvent.END, (event) => {
    for (const packageName of event.project.children?.map(
      (child) => child.name,
    ) ?? []) {
      const hasHybridObjects = existsSync(
        join(event.outputDirectory, packageName, 'hybrid-objects'),
      )
      writeFileSync(
        join(event.outputDirectory, packageName, 'meta.json'),
        JSON.stringify(
          {
            pages: [
              'index',
              ...(hasHybridObjects ? ['hybrid-objects'] : []),
              '...',
            ],
          },
          null,
          2,
        ),
      )
      if (hasHybridObjects) {
        writeFileSync(
          join(
            event.outputDirectory,
            packageName,
            'hybrid-objects',
            'meta.json',
          ),
          JSON.stringify({ title: 'Hybrid Objects' }, null, 2),
        )
      }
    }
  })
}

class NitroMemberRouter extends MemberRouter {
  getReflectionDirectory(reflection) {
    const directory = super.getReflectionDirectory(reflection)
    return isHybridObject(reflection)
      ? directory.replace(/\/interfaces$/, '/hybrid-objects')
      : directory
  }
}

function isHybridObject(reflection) {
  return reflection.extendedTypes?.some(
    (type) => type.type === 'reference' && type.name === 'HybridObject',
  )
}

function addHybridObjectsSection(contents) {
  const match = contents.match(/^## Interfaces\n\n((?:- .+\n)+)/m)
  if (!match) return contents

  const entries = match[1].split('\n').filter(Boolean)
  const hybridEntries = entries.filter((entry) =>
    entry.includes('hybrid-objects/'),
  )
  if (hybridEntries.length === 0) return contents

  const interfaceEntries = entries.filter(
    (entry) => !entry.includes('hybrid-objects/'),
  )
  const withoutHybrids = contents.replace(
    match[0],
    interfaceEntries.length > 0
      ? `## Interfaces\n\n${interfaceEntries.join('\n')}\n`
      : '',
  )
  const firstGroup = withoutHybrids.search(
    /^## (?:Enumerations|Classes|Interfaces|Type Aliases|Variables|Functions)\s*$/m,
  )
  if (firstGroup < 0) return withoutHybrids

  return `${withoutHybrids.slice(0, firstGroup)}## Hybrid Objects\n\n${hybridEntries.join('\n')}\n\n${withoutHybrids.slice(firstGroup)}`
}

function addSourceHeader(model, contents) {
  const source = model.sources?.[0]
  if (!source) return contents

  const extension = source.fileName.match(
    /\.(ts|tsx|js|jsx|cpp|cc|c|hpp|h|kt|swift)$/,
  )?.[1]
  const languages = {
    ts: 'TypeScript',
    tsx: 'TypeScript',
    js: 'JavaScript',
    jsx: 'JavaScript',
    cpp: 'C++',
    cc: 'C++',
    c: 'C',
    hpp: 'C++',
    h: 'C++',
    kt: 'Kotlin',
    swift: 'Swift',
  }
  const language = languages[extension]
  if (!language) return contents

  const nativeLink = isHybridObject(model)
    ? getNativeImplementationLink(source)
    : undefined
  const languagesInHeader = nativeLink ? `${language},C++` : language
  const sourceLinks = [
    source.url ? `[${language}](${source.url})` : undefined,
    nativeLink ? `[C++](${nativeLink})` : undefined,
  ].filter(Boolean)
  const sourceLine = sourceLinks.length
    ? `**Source files:** ${sourceLinks.join(' · ')}\n\n`
    : ''

  return contents
    .replace(/^Defined in: [^\n]+\n\n/m, '')
    .replace(
      /^# (.+?)(\n\n)/m,
      `<ApiSymbolHeader title="$1" languages="${languagesInHeader}" />$2${sourceLine}`,
    )
}

function getNativeImplementationLink(source) {
  const match = source.url?.match(
    /^(https:\/\/github\.com\/margelo\/react-native-nitro-sqlite\/blob\/[^/]+)\/(packages\/[^/]+)\/src\/specs\/([^/]+)\.nitro\.ts#L\d+$/,
  )
  if (!match) return undefined

  const [, baseUrl, packagePath, specName] = match
  const nativePath = `${packagePath}/cpp/hybridObjects/Hybrid${specName}.hpp`
  return existsSync(new URL(`../${nativePath}`, import.meta.url))
    ? `${baseUrl}/${nativePath}`
    : undefined
}
