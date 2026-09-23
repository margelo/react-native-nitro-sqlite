import { MarkdownPageEvent } from 'typedoc-plugin-markdown'

export function load(app) {
  app.renderer.on(MarkdownPageEvent.BEGIN, (page) => {
    page.frontmatter = { ...page.frontmatter, title: page.model.name }
  })

  app.renderer.on(MarkdownPageEvent.END, (page) => {
    page.contents = page.contents
      ?.replace(
        /\]\(([^):\s]*\/)?index\.mdx(#[^)]*)?\)/g,
        (_, directory, hash = '') => `](${directory ?? './'}${hash})`,
      )
      .replace(/\]\(([^):\s]+)\.mdx(#[^)]*)?\)/g, ']($1$2)')
  })
}
