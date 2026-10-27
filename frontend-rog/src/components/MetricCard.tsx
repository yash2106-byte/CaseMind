import { cn } from '@/lib/cn'

interface MetricCardProps {
  label: string
  value: string
  note: string
  tone?: 'neutral' | 'positive' | 'negative'
}

export function MetricCard({ label, value, note, tone = 'neutral' }: MetricCardProps) {
  return (
    <article className="min-w-0 border-b border-line-divider p-4 dark:border-line-divider-dark sm:border-b-0 sm:border-r sm:p-5 last:sm:border-r-0 xl:p-6">
      <p className="text-metric font-medium uppercase text-ink-muted dark:text-ink-muted-dark">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink dark:text-ink-dark">{value}</p>
      <p className={cn(
        'mt-1 text-cell',
        tone === 'neutral' && 'text-ink-secondary dark:text-ink-secondary-dark',
        tone === 'positive' && 'text-primary-700 dark:text-primary-300',
        tone === 'negative' && 'text-cost-foreground dark:text-cost',
      )}>
        {note}
      </p>
    </article>
  )
}
