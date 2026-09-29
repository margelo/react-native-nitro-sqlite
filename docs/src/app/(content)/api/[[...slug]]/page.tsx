import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import defaultMdxComponents from 'fumadocs-ui/mdx'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticleActions } from '@/components/article-actions'
import { ApiSymbolHeader } from '@/components/api-symbol-header'
import { MargeloCallout } from '@/lib/layout'
import { absoluteUrl, site } from '@/lib/site'
import { apiSource } from '@/lib/source'
import { getMDXComponents } from '@/mdx-components'

type Props = { params: Promise<{ slug?: string[] }> }

export default async function Page({ params }: Props) {
  const { slug } = await params
  const page = apiSource.getPage(slug)
  if (!page) notFound()

  const MDX = page.data.body
  const isOverview = !slug?.length
  const toc = page.data.toc?.filter((item) => item.depth <= 3)
  const rawMarkdown = await page.data.getText('raw')
  const sourceLink = rawMarkdown.match(
    /\*\*Source files:\*\* \[[^\]]+\]\((https:\/\/github\.com\/margelo\/react-native-nitro-sqlite\/blob\/[^)]+)\)/,
  )?.[1]
  const actions = (
    <ArticleActions
      markdownUrl={`/markdown${page.url}`}
      githubUrl={sourceLink ?? site.repositoryUrl}
    />
  )
  const isSymbol = rawMarkdown.includes('<ApiSymbolHeader ')

  return (
    <DocsPage
      toc={toc}
      full={page.data.full}
      tableOfContent={{ footer: <MargeloCallout /> }}
      tableOfContentPopover={{ footer: <MargeloCallout /> }}
    >
      {isOverview && <DocsTitle>{page.data.title}</DocsTitle>}
      {isOverview && <DocsDescription className="mb-2">{page.data.description}</DocsDescription>}
      {isOverview && actions}
      <DocsBody className="api-reference-body prose-lg prose-h3:text-2xl">
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(apiSource, page),
            ApiSymbolHeader: (props) => (
              <>
                <ApiSymbolHeader {...props} />
                {actions}
              </>
            ),
            h1: (props) => (
              <>
                <defaultMdxComponents.h1 {...props} />
                {!isOverview && !isSymbol && actions}
              </>
            ),
          })}
        />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return apiSource.generateParams()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = apiSource.getPage(slug)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: { canonical: page.url },
    openGraph: {
      siteName: site.name,
      title: page.data.title,
      description: page.data.description,
      url: absoluteUrl(page.url),
    },
  }
}
