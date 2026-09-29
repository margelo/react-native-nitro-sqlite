import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { sidebarOptions } from '@/lib/layout'
import { apiSource } from '@/lib/source'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DocsLayout
      tree={apiSource.pageTree}
      {...sidebarOptions()}
      containerProps={{
        className:
          'api-reference-layout md:[--fd-sidebar-width:19rem] lg:[--fd-sidebar-width:20rem]',
      }}
      sidebar={{ collapsible: false }}
      themeSwitch={{ enabled: false }}
      searchToggle={{ components: { lg: false } }}
    >
      {children}
    </DocsLayout>
  )
}
