import { CalloutContainer, CalloutTitle } from 'fumadocs-ui/components/callout'
import type { ComponentProps } from 'react'

type MdxCalloutContainerProps = Omit<
  ComponentProps<typeof CalloutContainer>,
  'type'
> & { type?: string }

export function MdxCalloutContainer({
  type,
  ...props
}: MdxCalloutContainerProps) {
  return <CalloutContainer {...props} type={resolveCalloutType(type)} />
}

export function MdxCalloutTitle({
  type: _type,
  ...props
}: ComponentProps<typeof CalloutTitle> & { type?: string }) {
  return <CalloutTitle {...props} />
}

function resolveCalloutType(
  type: string | undefined,
): ComponentProps<typeof CalloutContainer>['type'] | undefined {
  switch (type?.toLowerCase()) {
    case 'info':
      return 'info'
    case 'warn':
      return 'warn'
    case 'warning':
      return 'warning'
    case 'error':
      return 'error'
    case 'success':
      return 'success'
    case 'idea':
      return 'idea'
    default:
      return undefined
  }
}
