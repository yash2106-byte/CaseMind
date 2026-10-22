import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, CircleHelp, Clock3, MessageSquareText, Send } from 'lucide-react'
import {
  ApiError,
  createSession,
  getCase,
  getCaseTimeline,
  getCustomers,
  getHandoffSummary,
  recordActionOutcome,
  sendMessage,
} from '@/api/client'
import type {
  CaseDetail,
  CaseEvent,
  CaseStatus,
  Customer,
  HandoffSummary,
  SupportAction,
} from '@/api/types'
import { Button } from '@/components/shared/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingIndicator } from '@/components/shared/LoadingIndicator'
import { cn } from '@/lib/cn'

type ChatMessage = {
  id: string
  role: 'customer' | 'assistant'
  text: string
  kind?: string
  createdAt: string
}

type DetailLoad = 'loading' | 'ready' | 'error'
type PendingAction = 'session' | 'message' | 'outcome' | null

const ACTIVE_ACTION_STATUSES = new Set(['recommended', 'attempted', 'unknown'])
const MOCKED_STEPS = new Set(['check_area_outage', 'remote_line_reset', 'book_technician'])

function messageForError(error: unknown): string {
  if (error instanceof ApiError && error.requestId) {
    return `${error.message} (Request ID: ${error.requestId})`
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function StatusBadge({ status }: { status: CaseStatus }) {
  const label = status.replace('_', ' ')
  const classes: Record<CaseStatus, string> = {
    open: 'border-line-strong bg-surface-muted text-ink-secondary dark:border-line-strong-dark dark:bg-surface-muted-dark dark:text-ink-secondary-dark',
    in_progress: 'border-secondary-200 bg-secondary-50 text-secondary-800 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-200',
    escalated: 'border-cost-border bg-cost-background text-cost-foreground dark:border-cost dark:bg-cost/10 dark:text-cost',
    resolved: 'border-primary-200 bg-primary-50 text-primary-800 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-200',
    closed: 'border-line-strong bg-surface-muted text-ink-secondary dark:border-line-strong-dark dark:bg-surface-muted-dark dark:text-ink-secondary-dark',
  }
  return (
    <span className={cn('inline-flex items-center rounded-sm border px-2 py-0.5 text-caption font-medium capitalize', classes[status])}>
      {label}
    </span>
  )
}

function ActionStatus({ status }: { status: SupportAction['status'] }) {
  const classes: Record<SupportAction['status'], string> = {
    recommended: 'text-primary-700 dark:text-primary-300',
    attempted: 'text-secondary-800 dark:text-secondary-200',
    failed: 'text-cost-foreground dark:text-cost',
    succeeded: 'text-primary-700 dark:text-primary-300',
    unknown: 'text-ink-secondary dark:text-ink-secondary-dark',
    skipped: 'text-ink-muted dark:text-ink-muted-dark',
  }
  const label: Record<SupportAction['status'], string> = {
    recommended: 'Suggested',
    attempted: 'Attempted',
    failed: 'Failed',
    succeeded: 'Succeeded',
    unknown: 'Needs clarification',
    skipped: 'Skipped',
  }
  const Icon =
    status === 'succeeded'
      ? Check
      : status === 'failed'
        ? AlertTriangle
        : status === 'recommended' || status === 'attempted'
          ? Clock3
          : CircleHelp
  return (
    <span className={cn('inline-flex items-center gap-1 text-cell font-medium', classes[status])}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label[status]}
    </span>
  )
}

function SectionTitle({ children, trailing }: { children: string; trailing?: ReactNode }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-3">
      <h2 className="text-card font-semibold text-ink dark:text-ink-dark">{children}</h2>
      {trailing}
    </div>
  )
}

export function SupportPage() {
  const { caseId: routeCaseId } = useParams()
  const [searchParams] = useSearchParams()
  const requestedCustomerId = searchParams.get('customerId')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [events, setEvents] = useState<CaseEvent[]>([])
  const [handoff, setHandoff] = useState<HandoffSummary | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loadState, setLoadState] = useState<DetailLoad>('loading')
  const [pending, setPending] = useState<PendingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const polling = useRef(false)

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null
  const activeAction = useMemo(
    () => detail?.actions.find((action) => ACTIVE_ACTION_STATUSES.has(action.status)) ?? null,
    [detail],
  )

  const refreshCase = useCallback(async (id: string, signal?: AbortSignal) => {
    const [nextDetail, nextEvents] = await Promise.all([
      getCase(id, signal),
      getCaseTimeline(id, signal),
    ])
    if (signal?.aborted) return
    setDetail(nextDetail)
    setEvents(nextEvents)
    if (nextDetail.status === 'escalated') {
      const nextHandoff = await getHandoffSummary(id, signal)
      if (!signal?.aborted) setHandoff(nextHandoff)
    } else {
      setHandoff(null)
    }
    setLoadState('ready')
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoadState('loading')
    setError(null)
    setDetail(null)
    setEvents([])
    setHandoff(null)
    setSessionId(null)
    setMessages([])
    setDraft('')

    async function initialize() {
      try {
        const nextCustomers = await getCustomers(controller.signal)
        if (controller.signal.aborted) return
        setCustomers(nextCustomers)

        if (routeCaseId) {
          const nextCase = await getCase(routeCaseId, controller.signal)
          if (controller.signal.aborted) return
          setDetail(nextCase)
          setSelectedCustomerId(nextCase.customerId)
          const nextEvents = await getCaseTimeline(routeCaseId, controller.signal)
          if (controller.signal.aborted) return
          setEvents(nextEvents)
          if (nextCase.status === 'escalated') {
            setHandoff(await getHandoffSummary(routeCaseId, controller.signal))
          }
        } else {
          const requestedCustomer = nextCustomers.find((item) => item.id === requestedCustomerId)
          const savedCustomerId = localStorage.getItem('casemind-customer')
          const savedCustomer = nextCustomers.find((item) => item.id === savedCustomerId)
          setSelectedCustomerId((requestedCustomer ?? savedCustomer ?? nextCustomers[0])?.id ?? '')
        }
        if (!controller.signal.aborted) setLoadState('ready')
      } catch (cause) {
        if (controller.signal.aborted) return
        setError(messageForError(cause))
        setLoadState('error')
      }
    }

    void initialize()
    return () => controller.abort()
  }, [retryCount, routeCaseId, requestedCustomerId])

  useEffect(() => {
    if (!sessionId || !detail || !['open', 'in_progress'].includes(detail.status)) return
    const controller = new AbortController()
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || polling.current || !detail.id) return
      polling.current = true
      void refreshCase(detail.id, controller.signal)
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) setError(messageForError(cause))
        })
        .finally(() => {
          polling.current = false
        })
    }, 2000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      polling.current = false
    }
  }, [detail, refreshCase, sessionId])

  function addMessage(role: ChatMessage['role'], text: string, kind?: string) {
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, role, text, kind, createdAt: new Date().toISOString() },
    ])
  }

  async function beginSession() {
    if (!selectedCustomerId || pending) return
    setPending('session')
    setError(null)
    setNotice(null)
    setMessages([])
    setDraft('')
    try {
      const result = await createSession(selectedCustomerId)
      setSessionId(result.sessionId)
      localStorage.setItem('casemind-customer', selectedCustomerId)
      if (result.case) {
        await refreshCase(result.case.id)
        if (result.escalationRequired || result.case.status === 'escalated') {
          setNotice('This case reached the backend escalation state.')
        } else {
          setNotice('Existing case resumed. Previous actions and outcomes are shown below.')
        }
      } else {
        setDetail(null)
        setEvents([])
        setHandoff(null)
        setNotice('New support session started. Describe the internet connection issue.')
      }
    } catch (cause) {
      setError(messageForError(cause))
    } finally {
      setPending(null)
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!sessionId || !text || pending) return
    setPending('message')
    setError(null)
    setNotice(null)
    try {
      const result = await sendMessage(sessionId, text)
      addMessage('customer', text)
      addMessage('assistant', result.reply.text, result.reply.kind)
      setDraft('')
      if (result.case) {
        await refreshCase(result.case.id)
      }
    } catch (cause) {
      setError(messageForError(cause))
    } finally {
      setPending(null)
    }
  }

  async function submitOutcome(outcome: 'failed' | 'succeeded' | 'unknown') {
    if (!detail || !activeAction || pending) return
    setPending('outcome')
    setError(null)
    setNotice(null)
    try {
      const result = await recordActionOutcome(detail.id, activeAction.id, outcome)
      addMessage('assistant', result.reply.text, result.reply.kind)
      await refreshCase(result.case.id)
    } catch (cause) {
      setError(messageForError(cause))
    } finally {
      setPending(null)
    }
  }

  const timeline = [...events].sort(
    (left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt),
  )
  const controlsDisabled = pending !== null
  const caseClosed = detail ? ['escalated', 'resolved', 'closed'].includes(detail.status) : false
  const shouldShowStartSession = loadState === 'ready' && !sessionId

  if (loadState === 'loading') {
    return <div className="p-6"><LoadingIndicator label="Loading customers and case history" /></div>
  }

  if (loadState === 'error') {
    return (
      <section className="p-4 sm:p-6" role="alert">
        <EmptyState
          title="Could not load the support workspace"
          description={error ?? 'The CaseMind API is unavailable.'}
        />
        <Button className="ml-3" onClick={() => setRetryCount((value) => value + 1)}>Retry</Button>
        <Link to="/dashboard" className="ml-3 inline-flex items-center gap-2 text-cell font-medium text-primary-700 dark:text-primary-300">
          <ArrowLeft className="size-3.5" /> Back to overview
        </Link>
      </section>
    )
  }

  return (
    <div className="min-w-0">
      <section className="border-b border-line-divider px-4 py-5 dark:border-line-divider-dark sm:px-5 xl:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-metric font-medium uppercase tracking-wide text-primary-700 dark:text-primary-300">
              {detail ? 'Persistent support case' : 'Customer support'}
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-ink dark:text-ink-dark sm:text-2xl">
              {detail?.title ?? 'Internet connectivity'}
            </h1>
            <p className="mt-1 max-w-2xl text-body text-ink-secondary dark:text-ink-secondary-dark">
              {detail?.problemSummary ?? 'Start a support session to describe an internet connection problem.'}
            </p>
          </div>
          {detail ? <StatusBadge status={detail.status} /> : null}
        </div>
      </section>

      {error ? (
        <div role="alert" className="border-b border-cost-border bg-cost-background px-4 py-3 text-cell text-cost-foreground dark:border-cost dark:bg-cost/10 dark:text-cost sm:px-5">
          <p className="font-medium">Request failed</p>
          <p className="mt-0.5 break-words">{error}</p>
          {sessionId && detail && !caseClosed ? (
            <Button className="mt-2" onClick={() => { void refreshCase(detail.id).catch((cause: unknown) => setError(messageForError(cause))) }}>
              Retry case refresh
            </Button>
          ) : null}
        </div>
      ) : null}
      {notice ? <div role="status" className="border-b border-primary-200 bg-primary-50 px-4 py-2 text-cell text-primary-800 dark:border-primary-900 dark:bg-primary-950 dark:text-primary-200 sm:px-5">{notice}</div> : null}

      <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)]">
        <section className="min-w-0 border-b border-line-divider dark:border-line-divider-dark lg:border-b-0 lg:border-r lg:border-line-divider dark:lg:border-line-divider-dark">
          <div className="border-b border-line-divider px-4 py-4 dark:border-line-divider-dark sm:px-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="grid min-w-48 flex-1 gap-1.5 text-caption font-medium uppercase text-ink-muted dark:text-ink-muted-dark">
                Demo customer
                <select
                  value={selectedCustomerId}
                  onChange={(event) => {
                    setSelectedCustomerId(event.target.value)
                    setSessionId(null)
                    setDetail(null)
                    setEvents([])
                    setHandoff(null)
                    setMessages([])
                    setNotice(null)
                    setError(null)
                    localStorage.setItem('casemind-customer', event.target.value)
                  }}
                  disabled={Boolean(routeCaseId) || controlsDisabled}
                  className="h-9 rounded-control border border-input-border bg-input px-2 text-body font-normal text-ink disabled:opacity-70 dark:border-input-border-dark dark:bg-input-dark dark:text-ink-dark"
                >
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.displayName}</option>
                  ))}
                  {!customers.length ? <option value="">No seeded customers</option> : null}
                </select>
              </label>
              {shouldShowStartSession ? (
                <Button variant="solid" onClick={() => void beginSession()} disabled={!selectedCustomerId || controlsDisabled}>
                  {pending === 'session' ? 'Starting…' : detail ? 'Continue this case' : 'Start new chat'}
                </Button>
              ) : (
                <Button onClick={() => void beginSession()} disabled={!selectedCustomerId || controlsDisabled}>
                  {pending === 'session' ? 'Starting…' : 'Start new chat'}
                </Button>
              )}
            </div>
            {detail ? (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-cell sm:grid-cols-4">
                <div className="min-w-0">
                  <dt className="text-caption text-ink-muted dark:text-ink-muted-dark">Customer</dt>
                  <dd className="mt-0.5 truncate font-medium text-ink dark:text-ink-dark">{selectedCustomer?.displayName ?? 'Customer'}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted dark:text-ink-muted-dark">Contacts</dt>
                  <dd className="mt-0.5 font-medium tabular-nums text-ink dark:text-ink-dark">{detail.contactCount}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-muted dark:text-ink-muted-dark">Created</dt>
                  <dd className="mt-0.5 truncate font-medium text-ink dark:text-ink-dark">{formatDate(detail.createdAt)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-caption text-ink-muted dark:text-ink-muted-dark">Case ID</dt>
                  <dd className="mt-0.5 truncate font-mono text-caption text-ink-secondary dark:text-ink-secondary-dark" title={detail.id}>{detail.id}</dd>
                </div>
              </dl>
            ) : null}
          </div>

          <div className="flex min-h-96 flex-col">
            <div className="flex items-center justify-between border-b border-line-divider px-4 py-3 dark:border-line-divider-dark sm:px-5">
              <SectionTitle>Conversation</SectionTitle>
              {sessionId ? <span className="text-caption text-ink-muted dark:text-ink-muted-dark">Session active</span> : null}
            </div>

            {!sessionId ? (
              <div className="flex flex-1 flex-col justify-center p-4 sm:p-5">
                <EmptyState
                  title={detail ? 'Continue the support conversation' : 'Start a support conversation'}
                  description={detail
                    ? 'Starting a new chat will let the backend resume this case and apply its contact-count rules.'
                    : 'Choose one of the seeded demo customers, then start a chat to create a backend session.'}
                />
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 p-4 sm:p-5" aria-live="polite" aria-label="Conversation messages">
                  {messages.length === 0 ? (
                    <div className="flex min-h-48 flex-col items-center justify-center text-center">
                      <MessageSquareText className="size-5 text-ink-muted dark:text-ink-muted-dark" aria-hidden="true" />
                      <p className="mt-3 text-body font-medium text-ink dark:text-ink-dark">How can we help with your connection?</p>
                      <p className="mt-1 max-w-sm text-cell text-ink-secondary dark:text-ink-secondary-dark">
                        Describe what is happening. Case classification and troubleshooting are handled by the backend.
                      </p>
                    </div>
                  ) : null}
                  {messages.map((message) => (
                    <article key={message.id} className={cn('flex', message.role === 'customer' ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[92%] rounded-md border px-3 py-2.5 sm:max-w-[85%]',
                        message.role === 'customer'
                          ? 'border-primary-200 bg-primary-50 text-ink dark:border-primary-900 dark:bg-primary-950 dark:text-ink-dark'
                          : 'border-line bg-surface-subtle text-ink dark:border-line-dark dark:bg-surface-subtle-dark dark:text-ink-dark',
                      )}>
                        <p className="whitespace-pre-wrap break-words text-body">{message.text}</p>
                        <p className="mt-2 text-right text-caption text-ink-muted dark:text-ink-muted-dark">{formatDate(message.createdAt)}</p>
                      </div>
                    </article>
                  ))}
                  {pending === 'message' ? <LoadingIndicator label="Waiting for the support response" /> : null}
                </div>
                <form onSubmit={(event) => void submitMessage(event)} className="border-t border-line-divider p-4 dark:border-line-divider-dark sm:p-5">
                  {caseClosed ? (
                    <div className="mb-3 rounded-control border border-secondary-200 bg-secondary-50 px-3 py-2 text-cell text-secondary-800 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-200">
                      {detail?.status === 'escalated'
                        ? 'Automated troubleshooting has stopped for this escalated case.'
                        : detail?.status === 'resolved'
                          ? 'This case is resolved. Start a new chat if there is a different issue.'
                          : 'This case is closed. Start a new chat to report a new issue.'}
                    </div>
                  ) : null}
                  <label className="sr-only" htmlFor="support-message">Message</label>
                  <div className="flex items-end gap-2">
                    <textarea
                      id="support-message"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          event.currentTarget.form?.requestSubmit()
                        }
                      }}
                      placeholder={caseClosed ? 'Start a new chat to continue' : 'Describe the internet connection issue…'}
                      rows={2}
                      maxLength={2000}
                      disabled={caseClosed || controlsDisabled}
                      className="min-h-12 flex-1 resize-y rounded-control border border-input-border bg-input px-3 py-2 text-body text-ink placeholder:text-ink-muted disabled:opacity-60 dark:border-input-border-dark dark:bg-input-dark dark:text-ink-dark"
                    />
                    <Button type="submit" variant="solid" disabled={!draft.trim() || caseClosed || controlsDisabled} aria-label="Send message">
                      {pending === 'message' ? <LoadingIndicator label="Sending" /> : <Send className="size-4" aria-hidden="true" />}
                    </Button>
                  </div>
                  <p className="mt-1.5 text-right text-caption text-ink-muted dark:text-ink-muted-dark">Enter to send · Shift+Enter for a new line</p>
                </form>
              </>
            )}
          </div>
        </section>

        <aside className="min-w-0">
          <section className="border-b border-line-divider p-4 dark:border-line-divider-dark sm:p-5">
            <SectionTitle trailing={detail ? <span className="text-caption tabular-nums text-ink-muted dark:text-ink-muted-dark">Step {activeAction?.stepOrder ?? '—'} of 6</span> : undefined}>
              Current action
            </SectionTitle>
            {activeAction ? (
              <div className="mt-4 rounded-md border border-line bg-surface-subtle p-3 dark:border-line-dark dark:bg-surface-subtle-dark sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-body font-semibold text-ink dark:text-ink-dark">{activeAction.label}</h3>
                  <ActionStatus status={activeAction.status} />
                </div>
                <p className="mt-2 text-body leading-relaxed text-ink-secondary dark:text-ink-secondary-dark">{activeAction.instructions}</p>
                {MOCKED_STEPS.has(activeAction.stepKey) ? (
                  <p className="mt-3 rounded-sm border border-secondary-200 bg-secondary-50 px-2.5 py-2 text-cell text-secondary-800 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-200">
                    Demo simulation. No real ISP action is performed.
                  </p>
                ) : null}
                {sessionId && !caseClosed ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => void submitOutcome('failed')}
                      disabled={controlsDisabled}
                      className="text-cost-foreground dark:text-cost"
                    >
                      Failed
                    </Button>
                    <Button variant="solid" onClick={() => void submitOutcome('succeeded')} disabled={controlsDisabled}>
                      Succeeded
                    </Button>
                    <Button onClick={() => void submitOutcome('unknown')} disabled={controlsDisabled}>
                      Not sure
                    </Button>
                  </div>
                ) : null}
                <p className="mt-3 text-caption text-ink-muted dark:text-ink-muted-dark">
                  Outcome changes are recorded by the backend; the interface does not assume an action worked.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-cell text-ink-secondary dark:text-ink-secondary-dark">
                {detail?.status === 'escalated'
                  ? 'No further automated action is available for this escalated case.'
                  : detail?.status === 'resolved'
                    ? 'The backend has resolved this case. No further action is pending.'
                    : sessionId
                      ? 'No action is awaiting an outcome.'
                      : 'The current backend action will appear here after a support session starts.'}
              </p>
            )}
          </section>

          {detail?.status === 'escalated' ? (
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
                        {handoff.failedActions.map((action) => <li key={action}>{action}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <LoadingIndicator className="mt-3" label="Loading backend handoff summary" />
              )}
            </section>
          ) : null}

          <section className="p-4 dark:border-line-divider-dark sm:p-5" aria-labelledby="history-heading">
            <div className="flex items-center justify-between gap-3">
              <h2 id="history-heading" className="text-card font-semibold text-ink dark:text-ink-dark">Case timeline</h2>
              <span className="inline-flex items-center gap-1 text-caption text-ink-muted dark:text-ink-muted-dark">
                <Clock3 className="size-3" aria-hidden="true" />
                Oldest first
              </span>
            </div>
            {detail ? (
              timeline.length ? (
                <ol className="mt-4 space-y-0">
                  {timeline.map((event, index) => (
                    <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                      {index < timeline.length - 1 ? <span className="absolute bottom-0 left-[0.4375rem] top-3 w-px bg-line-divider dark:bg-line-divider-dark" aria-hidden="true" /> : null}
                      <span className={cn(
                        'relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full border',
                        event.type === 'case_escalated'
                          ? 'border-cost bg-cost'
                          : event.type === 'case_resolved'
                            ? 'border-primary-600 bg-primary-500'
                            : 'border-line-strong bg-surface dark:border-line-strong-dark dark:bg-surface-dark',
                      )} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
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

          {detail ? (
            <div className="border-t border-line-divider px-4 py-3 dark:border-line-divider-dark sm:px-5">
              <Link to="/dashboard" className="inline-flex items-center gap-2 text-cell font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200">
                <ArrowLeft className="size-3.5" aria-hidden="true" />
                Back to overview
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
