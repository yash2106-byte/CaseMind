import { cn } from '@/lib/cn'

interface LoadingIndicatorProps {
  label?: string
  className?: string
}

export function LoadingIndicator({ label = 'Loading', className }: LoadingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2 text-cell text-ink-secondary dark:text-ink-secondary-dark', className)} role="status">
      <span className="size-3 animate-spin rounded-full border border-line border-t-primary-500 dark:border-line-dark dark:border-t-primary-400" />
      <span>{label}</span>
    </div>
  )
}
