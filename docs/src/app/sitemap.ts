import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'
import { source } from '@/lib/source'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl('/'), priority: 1, changeFrequency: 'monthly' },
    ...source.getPages().map((page) => ({
      url: absoluteUrl(page.url),
      priority: page.url === '/docs' ? 0.9 : 0.7,
      changeFrequency: 'weekly' as const,
    })),
  ]
}
