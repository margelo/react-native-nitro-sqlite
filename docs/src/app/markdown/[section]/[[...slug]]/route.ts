import { notFound } from 'next/navigation'
import { apiSource, source } from '@/lib/source'

type Params = Promise<{ section: string; slug?: string[] }>

export async function GET(_request: Request, { params }: { params: Params }) {
  const { section, slug } = await params
  const collection = section === 'docs' ? source : section === 'api' ? apiSource : undefined
  if (!collection) notFound()

  const page = collection.getPage(slug)
  if (!page) notFound()

  const markdown = await page.data.getText('processed')
  const description = page.data.description ? `${page.data.description}\n\n` : ''

  return new Response(`# ${page.data.title}\n\n${description}${markdown}`, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}

export function generateStaticParams() {
  return [
    ...source.generateParams().map(({ slug }) => ({ section: 'docs', slug })),
    ...apiSource.generateParams().map(({ slug }) => ({ section: 'api', slug })),
  ]
}
