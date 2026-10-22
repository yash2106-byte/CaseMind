import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { getAllCases, getCase } from '@/api/cases'
import { getCustomers } from '@/api/customers'
import { getDashboardMetrics, resetDemoState } from '@/api/dashboard'
import { DEMO_MODE } from '@/lib/config'
import type { CaseDetail, CaseSummary, Customer, DashboardMetrics } from '@/types/api'
import { CaseStatusBadge } from '@/components/CaseStatusBadge'
import { MetricCard } from '@/components/MetricCard'
import { Button } from '@/components/shared/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingIndicator } from '@/components/shared/LoadingIndicator'
import { cn } from '@/lib/cn'
import { formatCount, formatPercent } from '@/lib/format'

type LoadState = 'loading' | 'ready' | 'error'
type CaseFilter = 'all' | 'active' | 'escalated' | 'resolved' | 'closed'

const FILTERS: Array<{ id: CaseFilter; label: string }> = [
  { id: 'all', label: 'All cases' },
  { id: 'active', label: 'Active' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'closed', label: 'Closed' },
]

const PAGE_SIZE = 10

function displayError(error: unknown): string {
  if (error instanceof Error && 'requestId' in error && typeof error.requestId === 'string') {
    return `${error.message} (Request ID: ${error.requestId})`
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred while loading case data.'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function CaseStatusBar({ metrics }: { metrics: DashboardMetrics }) {
  const distribution = [
    { label: 'In progress', count: metrics.openCases, className: 'bg-primary-500 dark:bg-primary-400' },
    { label: 'Resolved', count: metrics.resolvedCases, className: 'bg-secondary-400 dark:bg-secondary-500' },
    { label: 'Escalated', count: metrics.escalatedCases, className: 'bg-cost' },
  ]
  const displayedTotal = distribution.reduce((sum, item) => sum + item.count, 0)

  return (
    <section className="border-b border-line-divider p-4 dark:border-line-divider-dark sm:p-5 xl:p-6" aria-labelledby="case-status-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="case-status-heading" className="text-card font-semibold text-ink dark:text-ink-dark">Case status</h2>
          <p className="mt-1 text-cell text-ink-secondary dark:text-ink-secondary-dark">Active, resolved, and escalated cases</p>
        </div>
        <p className="text-cell tabular-nums text-ink-secondary dark:text-ink-secondary-dark">
          {formatCount(displayedTotal)} shown
        </p>
      </div>

      <div
        className="mt-5 flex h-2 overflow-hidden rounded-sm bg-surface-muted dark:bg-surface-muted-dark"
        role="img"
        aria-label={distribution.map(({ label, count }) => `${label}: ${count}`).join(', ')}
      >
        {distribution.map((item) => (
          <span
            key={item.label}
            className={cn('h-full transition-[width] duration-300', item.className)}
            style={{ width: displayedTotal ? `${(item.count / displayedTotal) * 100}%` : '0%' }}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {distribution.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-cell">
            <span className={cn('size-2 rounded-sm', item.className)} aria-hidden="true" />
            <span className="text-ink-secondary dark:text-ink-secondary-dark">{item.label}</span>
            <span className="font-medium tabular-nums text-ink dark:text-ink-dark">{formatCount(item.count)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function DashboardPage() {
  const [status, setStatus] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [details, setDetails] = useState<CaseDetail[]>([])
  const [resetting, setResetting] = useState(false)
  const [customerId, setCustomerId] = useState('all')
  const [filter, setFilter] = useState<CaseFilter>('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const inFlight = useRef(false)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    try {
      const [nextCustomers, nextMetrics] = await Promise.all([
        getCustomers(signal),
        getDashboardMetrics(signal),
      ])
      const nextCases = await getAllCases(nextCustomers, signal)
      const nextDetails = DEMO_MODE
        ? await Promise.all(nextCases.map((item) => getCase(item.id, signal)))
        : []
      if (signal?.aborted) return
      setCustomers(nextCustomers)
      setMetrics(nextMetrics)
      setCases(nextCases)
      setDetails(nextDetails)
      setStatus('ready')
    } catch (cause) {
      if (signal?.aborted) return
      setError(displayError(cause))
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'))
    } finally {
      inFlight.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refresh(controller.signal)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(controller.signal)
    }, 2000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      inFlight.current = false
    }
  }, [refresh])

  const customerNames = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.displayName])),
    [customers],
  )
  const detailById = useMemo(
    () => new Map(details.map((item) => [item.id, item])),
    [details],
  )
  const recentActivity = useMemo(
    () => details.flatMap((item) => item.events.map((event) => ({
      ...event,
      caseTitle: item.title,
    })))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 8),
    [details],
  )

  const visibleCases = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return cases
      .filter((item) => customerId === 'all' || item.customerId === customerId)
      .filter((item) => {
        if (filter === 'active') return item.status === 'open' || item.status === 'in_progress'
        if (filter !== 'all') return item.status === filter
        return true
      })
      .filter((item) => {
        if (!needle) return true
        return [
          item.id,
          item.title,
          detailById.get(item.id)?.problemSummary ?? '',
          detailById.get(item.id)?.actions.find((action) => action.stepKey === item.currentStepKey)?.label ?? '',
          item.status,
          customerNames.get(item.customerId) ?? '',
        ].some((value) => value.toLocaleLowerCase().includes(needle))
      })
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  }, [cases, customerId, customerNames, filter, query])

  const pageCount = Math.ceil(visibleCases.length / PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(pageCount, 1))
  const pageCases = visibleCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [customerId, filter, query])

  return (
    <div className="min-w-0">
      <section className="border-b border-line-divider px-4 py-5 dark:border-line-divider-dark sm:px-5 xl:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-metric font-medium uppercase tracking-wide text-primary-700 dark:text-primary-300">Case continuity</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-ink dark:text-ink-dark sm:text-2xl">Support overview</h1>
            <p className="mt-1 max-w-2xl text-body text-ink-secondary dark:text-ink-secondary-dark">
              Review active issues, previous troubleshooting outcomes, and cases requiring follow-up.
            </p>
          </div>
          <Button variant="solid" onClick={() => void refresh()} disabled={status === 'loading'}>
            <RefreshCw className="mr-2 size-3.5" aria-hidden="true" />
            Refresh
          </Button>
          {DEMO_MODE ? (
            <Button
              variant="ghost"
              onClick={() => {
                if (!window.confirm('Reset all demo cases, conversations, and activity to their original state?')) return
                setResetting(true)
                void resetDemoState()
                  .then(() => refresh())
                  .catch((cause: unknown) => setError(displayError(cause)))
                  .finally(() => setResetting(false))
              }}
              disabled={resetting}
            >
              <RotateCcw className="mr-2 size-3.5" aria-hidden="true" />
              {resetting ? 'Resetting…' : 'Reset demo'}
            </Button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div role="alert" className="flex items-start gap-2 border-b border-cost-border bg-cost-background px-4 py-3 text-cell text-cost-foreground dark:border-cost dark:bg-cost/10 dark:text-cost sm:px-5">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium">{status === 'error' ? 'Could not load CaseMind data' : 'Refresh failed'}</p>
            <p className="mt-0.5 break-words">{error}</p>
            {status === 'error' ? <Button className="mt-2" onClick={() => void refresh()}>Retry</Button> : null}
          </div>
        </div>
      ) : null}

      {status === 'loading' ? (
        <div className="p-6"><LoadingIndicator label="Loading customers, cases, and metrics" /></div>
      ) : null}

      {status === 'error' ? (
        <EmptyState
          title="Waiting for the backend"
          description="CaseMind reads customer, case, and dashboard data from the Phase 1 API. No sample case data is substituted when the API is unavailable."
          className="p-6"
        />
      ) : null}

      {status === 'ready' && metrics ? (
        <>
          <section className="grid grid-cols-2 border-b border-line-divider dark:border-line-divider-dark sm:grid-cols-4" aria-label="Case metrics">
            <MetricCard label="Total cases" value={formatCount(metrics.totalCases)} note="All recorded support cases" />
            <MetricCard label="In progress" value={formatCount(metrics.openCases)} note="Open or in progress" />
            <MetricCard label="Resolved" value={formatCount(metrics.resolvedCases)} note="Cases confirmed as resolved" tone="positive" />
            <MetricCard
              label="Escalated"
              value={formatCount(metrics.escalatedCases)}
              note="Requires human follow-up"
              tone={metrics.escalatedCases ? 'negative' : 'neutral'}
            />
          </section>

          <section className="grid border-b border-line-divider dark:border-line-divider-dark md:grid-cols-2">
            <div className="border-b border-line-divider dark:border-line-divider-dark md:border-b-0 md:border-r md:border-line-divider dark:md:border-line-divider-dark">
              <CaseStatusBar metrics={metrics} />
            </div>
            <div className="grid grid-cols-2">
              <MetricCard
                label="Repeat-contact rate"
                value={formatPercent(metrics.repeatContactRate * 100)}
                note="Cases with two or more contacts"
              />
              <MetricCard
                label="Repeated recommendations"
                value={formatPercent(metrics.repeatedRecommendationRate * 100)}
                note="Previously failed steps recommended again"
                tone={metrics.repeatedRecommendationRate > 0 ? 'negative' : 'positive'}
              />
            </div>
          </section>

          <section aria-labelledby="recent-cases-heading">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-divider px-4 py-4 dark:border-line-divider-dark sm:px-5">
              <div>
                <h2 id="recent-cases-heading" className="text-card font-semibold text-ink dark:text-ink-dark">Recent cases</h2>
                <p className="mt-1 text-cell text-ink-secondary dark:text-ink-secondary-dark">
                  {DEMO_MODE ? 'Canonical case state for the three seeded demo customers' : 'Latest customer support cases'}
                </p>
              </div>
              <label className="flex items-center gap-2 text-cell text-ink-secondary dark:text-ink-secondary-dark">
                <span>Customer</span>
                <select
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className="h-control max-w-48 rounded-control border border-input-border bg-input px-2 text-cell text-ink dark:border-input-border-dark dark:bg-input-dark dark:text-ink-dark"
                >
                  <option value="all">All customers</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.displayName}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-3 border-b border-line-divider px-4 py-3 dark:border-line-divider-dark sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter cases">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={cn(
                      'rounded-control px-2.5 py-1.5 text-cell transition-colors',
                      filter === item.id
                        ? 'bg-surface-muted font-semibold text-ink dark:bg-surface-muted-dark dark:text-ink-dark'
                        : 'text-ink-secondary hover:bg-surface-hover dark:text-ink-secondary-dark dark:hover:bg-surface-hover-dark',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label className="relative block w-full sm:max-w-search">
                <span className="sr-only">Search cases</span>
                <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted dark:text-ink-muted-dark" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search cases"
                  className="h-control w-full rounded-control border border-input-border bg-input pl-7 pr-2 text-cell text-ink placeholder:text-ink-muted dark:border-input-border-dark dark:bg-input-dark dark:text-ink-dark"
                />
              </label>
            </div>

            {pageCases.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[68rem] table-fixed text-left">
                    <thead className="bg-header-sub text-caption font-medium text-ink-secondary dark:bg-header-sub-dark dark:text-ink-secondary-dark">
                      <tr className="h-9 border-b border-line-divider dark:border-line-divider-dark">
                        <th className="w-[19%] px-4 sm:px-5">Case</th>
                        <th className="w-[13%] px-3">Customer</th>
                        <th className="w-[22%] px-3">Problem summary</th>
                        <th className="w-[16%] px-3">Current action</th>
                        <th className="w-[11%] px-3">Status</th>
                        <th className="w-[11%] px-3">Latest activity</th>
                        <th className="w-[8%] px-4 text-right sm:px-5">Contacts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageCases.map((item) => (
                        <tr key={item.id} className="h-14 border-b border-line-divider text-cell transition-colors hover:bg-surface-hover dark:border-line-divider-dark dark:hover:bg-surface-hover-dark">
                          <td className="px-4 sm:px-5">
                            <Link to={`/cases/${encodeURIComponent(item.id)}`} className="group block min-w-0 rounded-sm">
                              <span className="block truncate font-medium text-ink group-hover:text-primary-700 dark:text-ink-dark dark:group-hover:text-primary-300">{item.title}</span>
                              <span className="mt-0.5 block truncate font-mono text-caption text-ink-muted dark:text-ink-muted-dark">{item.id}</span>
                              <span className="mt-0.5 block text-caption font-medium text-primary-700 dark:text-primary-300">View case</span>
                            </Link>
                          </td>
                          <td className="truncate px-3 text-ink-secondary dark:text-ink-secondary-dark">{customerNames.get(item.customerId) ?? 'Unknown customer'}</td>
                          <td className="px-3">
                            <span className="block truncate text-ink-secondary dark:text-ink-secondary-dark" title={detailById.get(item.id)?.problemSummary}>
                              {detailById.get(item.id)?.problemSummary ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 text-ink-secondary dark:text-ink-secondary-dark">
                            <span className="block truncate">
                              {detailById.get(item.id)?.actions.find((action) => action.stepKey === item.currentStepKey)?.label ?? 'No active action'}
                            </span>
                          </td>
                          <td className="px-3"><CaseStatusBadge status={item.status} /></td>
                          <td className="px-3 tabular-nums text-ink-secondary dark:text-ink-secondary-dark">{formatDate(item.updatedAt)}</td>
                          <td className="px-4 text-right tabular-nums text-ink dark:text-ink-dark sm:px-5">
                            <span className="inline-flex items-center justify-end gap-1">
                              <span>{formatCount(item.contactCount)}</span>
                              <ArrowRight className="size-3 text-ink-muted" aria-hidden="true" />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-cell text-ink-secondary dark:text-ink-secondary-dark sm:px-5">
                  <span className="tabular-nums">
                    {visibleCases.length ? `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, visibleCases.length)} of ${visibleCases.length}` : '0 cases'}
                  </span>
                  <div className="flex gap-2">
                    <Button disabled={currentPage <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                    <Button disabled={currentPage >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</Button>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title={cases.length ? 'No cases match these filters' : 'No cases recorded'}
                description={cases.length ? 'Change the customer, status filter, or search terms.' : 'New cases will appear here after a customer starts an internet-connectivity support conversation.'}
                className="p-6"
                action={cases.length ? { label: 'Clear search and filters', onClick: () => { setQuery(''); setFilter('all'); setCustomerId('all') } } : undefined}
              />
            )}
          </section>

          <section className="border-t border-line-divider p-4 dark:border-line-divider-dark sm:p-5" aria-labelledby="recent-activity-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="recent-activity-heading" className="text-card font-semibold text-ink dark:text-ink-dark">Recent activity</h2>
              <p className="text-caption text-ink-muted dark:text-ink-muted-dark">
                {DEMO_MODE ? 'Updates as demo cases change' : 'Latest case activity'}
              </p>
            </div>
            {recentActivity.length ? (
              <ol className="mt-4 divide-y divide-line-divider dark:divide-line-divider-dark">
                {recentActivity.map((event) => (
                  <li key={event.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0">
                    <div className="min-w-0">
                      <Link
                        to={`/cases/${encodeURIComponent(event.caseId)}`}
                        className="text-cell font-medium text-ink hover:text-primary-700 dark:text-ink-dark dark:hover:text-primary-300"
                      >
                        {event.message}
                      </Link>
                      <p className="mt-1 truncate text-caption text-ink-secondary dark:text-ink-secondary-dark">{event.caseTitle}</p>
                    </div>
                    <time className="shrink-0 text-caption tabular-nums text-ink-muted dark:text-ink-muted-dark" dateTime={event.createdAt}>
                      {formatDate(event.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-cell text-ink-secondary dark:text-ink-secondary-dark">
                No recent case activity is available.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
