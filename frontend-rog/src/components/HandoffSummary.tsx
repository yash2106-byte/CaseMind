import { AlertTriangle } from 'lucide-react'
import type { CaseDetail, HandoffSummary as HandoffSummaryData } from '@/types/api'
import { LoadingIndicator } from '@/components/shared/LoadingIndicator'

function escalationReason(summary: string): string | null {
  const normalized = summary.toLocaleLowerCase()
  if (normalized.includes('contact_limit_reached') || /contact.{0,24}limit/.test(normalized)) {
    return 'Third contact reached the contact limit'
  }
  if (normalized.includes('playbook_exhausted') || normalized.includes('playbook exhausted')) {
    return 'Troubleshooting playbook exhausted'
  }
  return null
}

interface HandoffSummaryProps {
  handoff: HandoffSummaryData | null
  detail: CaseDetail | null
}

export function HandoffSummary({ handoff, detail }: HandoffSummaryProps) {
  return (
    <section className="border-b border-line-divider p-4 dark:border-line-divider-dark sm:p-5" aria-labelledby="handoff-heading">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-cost-foreground dark:text-cost" aria-hidden="true" />
        <h2 id="handoff-heading" className="text-card font-semibold text-ink dark:text-ink-dark">Escalation handoff</h2>
      </div>
      <p className="mt-3 text-body font-medium text-ink dark:text-ink-dark">
        This is a simulated handoff. No live human agent has been notified.
      </p>
      {handoff ? (
        <>
          <p className="mt-3 whitespace-pre-wrap text-cell leading-relaxed text-ink-secondary dark:text-ink-secondary-dark">{handoff.summary}</p>
          <p className="mt-3 text-cell text-ink-secondary dark:text-ink-secondary-dark">
            Contacts: <span className="font-medium tabular-nums text-ink dark:text-ink-dark">{handoff.contactCount}</span>
          </p>
          {handoff.failedActions.length ? (
            <div className="mt-3">
              <p className="text-caption font-medium uppercase text-ink-muted dark:text-ink-muted-dark">Failed steps</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-cell text-cost-foreground dark:text-cost">
                {handoff.failedActions.map((action) => (
                  <li key={action}>{detail?.actions.find((item) => item.stepKey === action)?.label ?? action}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {escalationReason(handoff.summary) ? (
            <p className="mt-3 text-cell text-ink-secondary dark:text-ink-secondary-dark">
              Escalation reason: <span className="font-medium text-ink dark:text-ink-dark">{escalationReason(handoff.summary)}</span>
            </p>
          ) : null}
        </>
      ) : (
        <LoadingIndicator className="mt-3" label="Loading backend handoff summary" />
      )}
    </section>
  )
}
