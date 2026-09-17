import { RootProvider } from 'fumadocs-ui/provider/next'
import type { Metadata } from 'next'
import { site } from '@/lib/site'
import './global.css'

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  applicationName: site.name,
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description,
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: site.name,
    description: site.description,
  },
  twitter: { card: 'summary' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}
