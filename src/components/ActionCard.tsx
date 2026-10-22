import { AlertTriangle, Check, CircleHelp, Clock3 } from 'lucide-react'
import type { ActionOutcome, SupportAction } from '@/types/api'
import { Button } from '@/components/shared/Button'
import { cn } from '@/lib/cn'

const MOCKED_STEPS = new Set(['check_area_outage', 'remote_line_reset', 'book_technician'])
const ACTIVE_ACTION_STATUSES = new Set(['recommended', 'attempted', 'unknown'])

function ActionStatus({ status }: { status: SupportAction['status'] }) {
  const classes: Record<SupportAction['status'], string> = {
    recommended: 'text-primary-700 dark:text-primary-300',
    attempted: 'text-secondary-800 dark:text-secondary-200',
    failed: 'text-cost-foreground dark:text-cost',
    succeeded: 'text-primary-700 dark:text-primary-300',
    unknown: 'text-ink-secondary dark:text-ink-secondary-dark',
    skipped: 'text-ink-muted dark:text-ink-muted-dark',
  }
  const labels: Record<SupportAction['status'], string> = {
    recommended: 'Suggested',
    attempted: 'Attempted',
    failed: 'Failed',
    succeeded: 'Succeeded',
    unknown: 'Needs clarification',
    skipped: 'Skipped',
  }
  const Icon = status === 'succeeded'
    ? Check
    : status === 'failed'
      ? AlertTriangle
      : status === 'recommended' || status === 'attempted'
        ? Clock3
        : CircleHelp

  return (
    <span className={cn('inline-flex items-center gap-1 text-cell font-medium', classes[status])}>
      <Icon className="size-3.5" aria-hidden="true" />
      {labels[status]}
    </span>
  )
}

interface ActionCardProps {
  action: SupportAction | null
  hasSession: boolean
  caseStatus: string | null
  pending: boolean
  onOutcome: (outcome: ActionOutcome) => void
}

export function ActionCard({ action, hasSession, caseStatus, pending, onOutcome }: ActionCardProps) {
  const isTerminal = caseStatus !== null && ['escalated', 'resolved', 'closed'].includes(caseStatus)
  const activeAction = action && ACTIVE_ACTION_STATUSES.has(action.status) && !isTerminal ? action : null

  return (
    <section className="border-b border-line-divider p-4 dark:border-line-divider-dark sm:p-5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h2 className="text-card font-semibold text-ink dark:text-ink-dark">Current action</h2>
        {caseStatus ? (
          <span className="text-caption tabular-nums text-ink-muted dark:text-ink-muted-dark">
            Step {activeAction?.stepOrder ?? '—'} of 6
          </span>
        ) : null}
      </div>
      {activeAction ? (
        <div className="mt-4 rounded-md border border-line bg-surface-subtle p-3 dark:border-line-dark dark:bg-surface-subtle-dark sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-body font-semibold text-ink dark:text-ink-dark">{activeAction.label}</h3>
            <ActionStatus status={activeAction.status} />
          </div>
          <p className="mt-2 text-body leading-relaxed text-ink-secondary dark:text-ink-secondary-dark">{activeAction.instructions}</p>
          {MOCKED_STEPS.has(activeAction.stepKey) ? (
            <p className="mt-3 rounded-sm border border-secondary-200 bg-secondary-50 px-2.5 py-2 text-cell text-secondary-800 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-200">
              Demo simulation — no real ISP action is performed.
            </p>
          ) : null}
          {activeAction.status === 'unknown' ? (
            <p className="mt-3 rounded-sm border border-line bg-surface px-2.5 py-2 text-cell text-ink-secondary dark:border-line-dark dark:bg-surface-dark dark:text-ink-secondary-dark">
              This action is still awaiting clarification. The backend has not advanced to a different step.
            </p>
          ) : null}
          {hasSession && !isTerminal ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => onOutcome('failed')} disabled={pending} className="text-cost-foreground dark:text-cost">Failed</Button>
              <Button variant="solid" onClick={() => onOutcome('succeeded')} disabled={pending}>Succeeded</Button>
              <Button onClick={() => onOutcome('unknown')} disabled={pending}>Not sure / Unknown</Button>
            </div>
          ) : null}
          <p className="mt-3 text-caption text-ink-muted dark:text-ink-muted-dark">
            Outcome changes are recorded by the backend; the interface does not assume an action worked.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-cell text-ink-secondary dark:text-ink-secondary-dark">
          {caseStatus === 'escalated'
            ? 'No further automated action is available for this escalated case.'
            : caseStatus === 'resolved'
              ? 'The backend has resolved this case. No further action is pending.'
              : hasSession
                ? 'No action is awaiting an outcome.'
                : 'The current backend action will appear here after a support session starts.'}
        </p>
      )}
    </section>
  )
}
