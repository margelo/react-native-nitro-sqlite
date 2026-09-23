import type { HomeLayoutProps } from 'fumadocs-ui/layouts/home'
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch'
import Image from 'next/image'
import { site } from '@/lib/site'

export function homeOptions(): HomeLayoutProps {
  return {
    nav: { title: <Brand /> },
    links: [
      { text: 'Docs', url: '/docs', active: 'nested-url' },
      { text: 'API Reference', url: '/api', active: 'nested-url' },
      {
        type: 'icon',
        text: 'Margelo',
        label: 'Margelo',
        url: 'https://margelo.com',
        icon: <MargeloIcon />,
        external: true,
      },
    ],
    githubUrl: site.repositoryUrl,
  }
}

export function sidebarOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Brand className="md:hidden" />,
      children: <div className="flex justify-end pe-2 md:hidden"><ThemeSwitch /></div>,
    },
  }
}

function Brand({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image src="/nitro-sqlite-mark.svg" alt="" width={28} height={28} priority />
      <span className="font-semibold tracking-[-0.045em] text-[1.05rem]">NitroSQLite</span>
    </span>
  )
}

function MargeloIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 30 30" fill="currentColor">
      <path d="M0 0V30H30L0 0Z" />
      <path d="M30 0V30L19.007 10.9941L30 0Z" />
    </svg>
  )
}
