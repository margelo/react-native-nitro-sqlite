import { CalloutDescription } from 'fumadocs-ui/components/callout'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import { ApiSymbolHeader } from '@/components/api-symbol-header'
import { MdxCalloutContainer, MdxCalloutTitle } from '@/components/mdx-callout'

export function getMDXComponents(
  components?: Partial<typeof defaultMdxComponents> & {
    ApiSymbolHeader?: typeof ApiSymbolHeader
  },
) {
  return {
    ...defaultMdxComponents,
    ApiSymbolHeader,
    'callout-root': MdxCalloutContainer,
    'callout-title': MdxCalloutTitle,
    'callout-body': CalloutDescription,
    ...components,
  }
}
