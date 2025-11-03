export interface QueuedOperation {
  start: () => void
}

export const locks: Record<
  string,
  { queue: QueuedOperation[]; inProgress: boolean }
> = {}
