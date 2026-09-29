import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticleActions } from '@/components/article-actions'
import { MargeloCallout } from '@/lib/layout'
import { absoluteUrl, site } from '@/lib/site'
import { source } from '@/lib/source'
import { getMDXComponents } from '@/mdx-components'

type Props = { params: Promise<{ slug?: string[] }> }

export default async function Page({ params }: Props) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const MDX = page.data.body

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{ footer: <MargeloCallout /> }}
      tableOfContentPopover={{ footer: <MargeloCallout /> }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-2">{page.data.description}</DocsDescription>
      <ArticleActions
        markdownUrl={`/markdown${page.url}`}
        githubUrl={`${site.repositoryUrl}/blob/main/docs/content/docs/${page.data.info.path}`}
      />
      <DocsBody className="prose-lg prose-h3:text-2xl">
        <MDX components={getMDXComponents({ a: createRelativeLink(source, page) })} />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = source.getPage(slug)
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
