import type {
  Callout,
  NodeOptions,
  Options as RemarkCalloutOptions,
} from '@r4ai/remark-callout'
import remarkCallout from '@r4ai/remark-callout'
import { defineConfig, defineDocs } from 'fumadocs-mdx/config'

export const docs = defineDocs({
  dir: 'content/docs',
  docs: { postprocess: { includeProcessedMarkdown: true } },
})

export const apiReference = defineDocs({
  dir: 'content/api',
  docs: { postprocess: { includeProcessedMarkdown: true } },
})

const remarkCalloutOptions: RemarkCalloutOptions = {
  root: (callout) => createCalloutNode('callout-root', callout),
  title: (callout) => createCalloutNode('callout-title', callout),
  body: () => ({ tagName: 'callout-body', properties: {} }),
}

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [[remarkCallout, remarkCalloutOptions]],
  },
})

function createCalloutNode(tagName: string, callout: Callout): NodeOptions {
  const type = callout.type.toLowerCase()
  return {
    tagName,
    properties: {
      type: type === 'important' ? 'info' : type,
    },
  }
}
