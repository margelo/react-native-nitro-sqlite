import { HomeLayout } from 'fumadocs-ui/layouts/home'
import type { Metadata } from 'next'
import { homeOptions } from '@/lib/layout'
import { absoluteUrl, site } from '@/lib/site'

export const metadata: Metadata = {
  title: 'NitroSQLite for React Native',
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: 'NitroSQLite for React Native',
    description: site.description,
    url: absoluteUrl('/'),
  },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <HomeLayout {...homeOptions()} className="home-shell">{children}</HomeLayout>
}
