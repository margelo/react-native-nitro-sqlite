import { MarkdownPageEvent } from 'typedoc-plugin-markdown'
import { addPackageIntro } from './api-package-intros.mjs'

export function load(app) {
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

    page.contents = addPackageIntro(page.model.name, contents)
      ?.replace(
        /\]\(([^):\s]*\/)?index\.mdx(#[^)]*)?\)/g,
        (_, directory, hash = '') => `](${directory ?? './'}${hash})`,
      )
      .replace(/\]\(([^):\s]+)\.mdx(#[^)]*)?\)/g, ']($1$2)')
  })
}
