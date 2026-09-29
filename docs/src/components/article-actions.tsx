'use client'

import { buttonVariants } from 'fumadocs-ui/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'fumadocs-ui/components/ui/popover'
import { MarkdownCopyButton } from 'fumadocs-ui/layouts/docs/page'
import { ChevronDown, ExternalLink, MessageCircle, Sparkles } from 'lucide-react'
import type { SVGProps } from 'react'
import { absoluteUrl } from '@/lib/site'

type ArticleActionsProps = {
  markdownUrl: string
  githubUrl: string
}

export function ArticleActions({ markdownUrl, githubUrl }: ArticleActionsProps) {
  const prompt = `Read ${absoluteUrl(markdownUrl)}, I want to ask questions about it.`
  const links = [
    { label: 'Open in GitHub', href: githubUrl, icon: GithubIcon },
    {
      label: 'Open in ChatGPT',
      href: `https://chatgpt.com/?${new URLSearchParams({ hints: 'search', q: prompt })}`,
      icon: MessageCircle,
    },
    {
      label: 'Open in Claude',
      href: `https://claude.ai/new?${new URLSearchParams({ q: prompt })}`,
      icon: Sparkles,
    },
  ]

  return (
    <div className="not-prose flex flex-wrap items-center gap-2 border-b border-fd-border pb-6">
      <MarkdownCopyButton markdownUrl={markdownUrl} />
      <Popover>
        <PopoverTrigger
          className={`${buttonVariants({ color: 'secondary', size: 'sm' })} gap-2 data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground`}
        >
          Open
          <ChevronDown aria-hidden="true" className="size-3.5 text-fd-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="flex flex-col">
          {links.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-2 focus-visible:outline-fd-primary [&_svg]:size-4"
            >
              <Icon aria-hidden="true" />
              {label}
              <ExternalLink aria-hidden="true" className="ms-auto text-fd-muted-foreground" />
            </a>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
    </svg>
  )
}
