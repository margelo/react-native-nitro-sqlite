import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { MargeloCallout, sidebarOptions } from '@/lib/layout'
import { source } from '@/lib/source'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...sidebarOptions()}
      sidebar={{ collapsible: false, footer: <MargeloCallout /> }}
      themeSwitch={{ enabled: false }}
      searchToggle={{ components: { lg: false } }}
    >
      {children}
    </DocsLayout>
  )
}
