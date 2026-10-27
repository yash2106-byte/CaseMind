import { cn } from '@/lib/cn'

interface EmptyStateProps {
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-start gap-2 px-3 py-6', className)}>
      <p className="text-body font-semibold text-ink dark:text-ink-dark">{title}</p>
      <p className="text-cell text-ink-secondary dark:text-ink-secondary-dark">{description}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="text-cell font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
