import { Clock3 } from 'lucide-react'
import type { CaseEvent } from '@/types/api'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingIndicator } from '@/components/shared/LoadingIndicator'
import { cn } from '@/lib/cn'

const EVENT_LABELS: Record<string, string> = {
  case_created: 'Case created',
  contact_started: 'Support contact started',
  message_received: 'Customer message received',
  assistant_response: 'Assistant response',
  action_recommended: 'Troubleshooting action recommended',
  action_outcome_recorded: 'Action outcome recorded',
  case_escalated: 'Case escalated',
  case_resolved: 'Case resolved',
  case_reopened: 'Case reopened',
  summary_generated: 'Handoff summary generated',
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

interface CaseTimelineProps {
  events: CaseEvent[]
  hasCase: boolean
  loading: boolean
}

export function CaseTimeline({ events, hasCase, loading }: CaseTimelineProps) {
  const chronological = [...events].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  )

  return (
    <section className="p-4 dark:border-line-divider-dark sm:p-5" aria-labelledby="history-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="history-heading" className="text-card font-semibold text-ink dark:text-ink-dark">Case timeline</h2>
        <span className="inline-flex items-center gap-1 text-caption text-ink-muted dark:text-ink-muted-dark">
          <Clock3 className="size-3" aria-hidden="true" />
          Oldest first
        </span>
      </div>
      {loading ? (
        <LoadingIndicator className="mt-4" label="Loading case timeline" />
      ) : hasCase ? (
        chronological.length ? (
          <ol className="mt-4 space-y-0">
            {chronological.map((event, index) => (
              <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < chronological.length - 1 ? (
                  <span className="absolute bottom-0 left-[0.4375rem] top-3 w-px bg-line-divider dark:bg-line-divider-dark" aria-hidden="true" />
                ) : null}
                <span className={cn(
                  'relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full border',
                  event.type === 'case_escalated'
                    ? 'border-cost bg-cost'
                    : event.type === 'case_resolved'
                      ? 'border-primary-600 bg-primary-500'
                      : 'border-line-strong bg-surface dark:border-line-strong-dark dark:bg-surface-dark',
                )} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-semibold text-ink-secondary dark:text-ink-secondary-dark">
                    {EVENT_LABELS[event.type] ?? event.type.replaceAll('_', ' ')}
                  </p>
                  <p className="text-cell leading-relaxed text-ink dark:text-ink-dark">{event.message}</p>
                  <p className="mt-1 text-caption tabular-nums text-ink-muted dark:text-ink-muted-dark">{formatDate(event.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No timeline events" description="Case activity will appear here when recorded by the backend." className="px-0 py-5" />
        )
      ) : (
        <EmptyState title="No case selected" description="Start a session or open a case to see its persistent history." className="px-0 py-5" />
      )}
    </section>
  )
}
