import defaultMdxComponents from 'fumadocs-ui/mdx'

export function getMDXComponents(
  components?: Partial<typeof defaultMdxComponents>,
) {
  return { ...defaultMdxComponents, ...components }
}
