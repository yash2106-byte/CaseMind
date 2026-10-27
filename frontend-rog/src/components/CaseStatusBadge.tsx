import type { CaseStatus } from '@/types/api'
import { cn } from '@/lib/cn'

const STATUS_CLASSES: Record<CaseStatus, string> = {
  open: 'border-line-strong bg-surface-muted text-ink-secondary dark:border-line-strong-dark dark:bg-surface-muted-dark dark:text-ink-secondary-dark',
  in_progress: 'border-secondary-200 bg-secondary-50 text-secondary-800 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-200',
  escalated: 'border-cost-border bg-cost-background text-cost-foreground dark:border-cost dark:bg-cost/10 dark:text-cost',
  resolved: 'border-primary-200 bg-primary-50 text-primary-800 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-200',
  closed: 'border-line-strong bg-surface-muted text-ink-secondary dark:border-line-strong-dark dark:bg-surface-muted-dark dark:text-ink-secondary-dark',
}

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-sm border px-2 py-0.5 text-caption font-medium capitalize', STATUS_CLASSES[status])}>
      {status.replace('_', ' ')}
    </span>
  )
}
