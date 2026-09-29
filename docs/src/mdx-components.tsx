import defaultMdxComponents from 'fumadocs-ui/mdx'
import { ApiSymbolHeader } from '@/components/api-symbol-header'

export function getMDXComponents(
  components?: Partial<typeof defaultMdxComponents> & {
    ApiSymbolHeader?: typeof ApiSymbolHeader
  },
) {
  return { ...defaultMdxComponents, ApiSymbolHeader, ...components }
}
