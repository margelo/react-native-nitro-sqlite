import { defineConfig, defineDocs } from 'fumadocs-mdx/config'

export const docs = defineDocs({
  dir: 'content/docs',
  docs: { postprocess: { includeProcessedMarkdown: true } },
})

export const apiReference = defineDocs({
  dir: 'content/api',
  docs: { postprocess: { includeProcessedMarkdown: true } },
})

export default defineConfig()
