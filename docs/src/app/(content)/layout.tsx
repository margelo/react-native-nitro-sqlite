import { HomeLayout } from 'fumadocs-ui/layouts/home'
import { homeOptions } from '@/lib/layout'

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs-shell flex flex-col">
      <HomeLayout {...homeOptions()} className="max-md:hidden" />
      {children}
    </div>
  )
}
