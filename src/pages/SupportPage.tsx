import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ApiError } from '@/api/client'
import { getCase, getCaseTimeline, getHandoffSummary, recordActionOutcome } from '@/api/cases'
import { getCustomers } from '@/api/customers'
import { createSession, sendMessage } from '@/api/sessions'
import type {
  CaseDetail,
  CaseEvent,
  Customer,
  HandoffSummary,
  ReplyKind,
} from '@/types/api'
import type { ChatMessage } from '@/types/chat'
import { ActionCard } from '@/components/ActionCard'
import { CaseStatusBadge } from '@/components/CaseStatusBadge'
import { CaseTimeline } from '@/components/CaseTimeline'
import { ChatPanel } from '@/components/ChatPanel'
import { CustomerSelector } from '@/components/CustomerSelector'
import { HandoffSummary as HandoffSummaryCard } from '@/components/HandoffSummary'
import { Button } from '@/components/shared/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingIndicator } from '@/components/shared/LoadingIndicator'

type DetailLoad = 'loading' | 'ready' | 'error'
type PendingAction = 'session' | 'message' | 'outcome' | null

const ACTIVE_ACTION_STATUSES = new Set(['recommended', 'attempted', 'unknown'])

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

export function SupportPage() {
  const { caseId: routeCaseId } = useParams()
  const [searchParams] = useSearchParams()
  const requestedCustomerId = searchParams.get('customerId')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [events, setEvents] = useState<CaseEvent[]>([])
  const [handoff, setHandoff] = useState<HandoffSummary | null>(null)
  const [sessionEscalated, setSessionEscalated] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loadState, setLoadState] = useState<DetailLoad>('loading')
  const [pending, setPending] = useState<PendingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const polling = useRef(false)
  const caseRevision = useRef(0)

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null
  const activeAction = useMemo(
    () => detail && !['escalated', 'resolved', 'closed'].includes(detail.status)
      ? detail.actions.find((action) => ACTIVE_ACTION_STATUSES.has(action.status)) ?? null
      : null,
    [detail],
  )

  const refreshCase = useCallback(async (id: string, signal?: AbortSignal) => {
    const revision = caseRevision.current
    const [nextDetail, nextEvents] = await Promise.all([
      getCase(id, signal),
      getCaseTimeline(id, signal),
    ])
    if (signal?.aborted || revision !== caseRevision.current) return
    const nextHandoff = nextDetail.status === 'escalated'
      ? await getHandoffSummary(id, signal)
      : null
    if (signal?.aborted || revision !== caseRevision.current) return
    setDetail(nextDetail)
    setEvents(nextEvents)
    setHandoff(nextHandoff)
    setSessionEscalated(nextDetail.status === 'escalated')
    setLoadState('ready')
  }, [])

  useEffect(() => {
    caseRevision.current += 1
    const controller = new AbortController()
    setLoadState('loading')
    setError(null)
    setDetail(null)
    setEvents([])
    setHandoff(null)
    setSessionEscalated(false)
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

  function addMessage(role: ChatMessage['role'], text: string, kind?: ReplyKind) {
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
    setHandoff(null)
    setSessionEscalated(false)
    try {
      const result = await createSession(selectedCustomerId)
      caseRevision.current += 1
      setSessionId(result.sessionId)
      localStorage.setItem('casemind-customer', selectedCustomerId)
      if (result.case) {
        const isEscalated = result.escalationRequired || result.case.status === 'escalated'
        setSessionEscalated(isEscalated)
        if (isEscalated && result.handoffSummary) {
          setHandoff({
            caseId: result.case.id,
            summary: result.handoffSummary,
            contactCount: result.case.contactCount,
            failedActions: [],
            timeline: [],
          })
        }
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
        setSessionEscalated(false)
        setNotice('New support session started. Describe the internet connection issue.')
      }
    } catch (cause) {
      setError(messageForError(cause))
    } finally {
      setPending(null)
    }
  }

  async function sendDraftMessage() {
    const text = draft.trim()
    if (!sessionId || !text || pending) return
    setPending('message')
    setError(null)
    setNotice(null)
    try {
      const result = await sendMessage(sessionId, text)
      caseRevision.current += 1
      addMessage('customer', text)
      addMessage('assistant', result.reply.text, result.reply.kind)
      setDraft('')
      if (result.case) {
        setDetail(result.case)
        setEvents(result.case.events)
        setSessionEscalated(result.case.status === 'escalated')
        if (result.case.status === 'escalated') {
          setHandoff(result.case.handoffSummary
            ? {
                caseId: result.case.id,
                summary: result.case.handoffSummary,
                contactCount: result.case.contactCount,
                failedActions: [],
                timeline: result.case.events,
              }
            : null)
        } else {
          setHandoff(null)
        }
        void refreshCase(result.case.id).catch((cause: unknown) => setError(messageForError(cause)))
      }
    } catch (cause) {
      setError(messageForError(cause))
    } finally {
      setPending(null)
    }
  }

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendDraftMessage()
  }

  async function submitOutcome(outcome: 'failed' | 'succeeded' | 'unknown') {
    if (!detail || !activeAction || pending) return
    setPending('outcome')
    setError(null)
    setNotice(null)
    try {
      const result = await recordActionOutcome(detail.id, activeAction.id, outcome)
      caseRevision.current += 1
      addMessage('assistant', result.reply.text, result.reply.kind)
      setDetail(result.case)
      setEvents(result.case.events)
      setSessionEscalated(result.case.status === 'escalated')
      if (result.case.status === 'escalated' && result.case.handoffSummary) {
        setHandoff({
          caseId: result.case.id,
          summary: result.case.handoffSummary,
          contactCount: result.case.contactCount,
          failedActions: [],
          timeline: result.case.events,
        })
      } else {
        setHandoff(null)
      }
      void refreshCase(result.case.id).catch((cause: unknown) => setError(messageForError(cause)))
    } catch (cause) {
      setError(messageForError(cause))
    } finally {
      setPending(null)
    }
  }

  const controlsDisabled = pending !== null
  const caseClosed = sessionEscalated || (detail ? ['escalated', 'resolved', 'closed'].includes(detail.status) : false)
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
          {detail ? <CaseStatusBadge status={detail.status} /> : null}
        </div>
      </section>

      {error ? (
        <div role="alert" className="border-b border-cost-border bg-cost-background px-4 py-3 text-cell text-cost-foreground dark:border-cost dark:bg-cost/10 dark:text-cost sm:px-5">
          <p className="font-medium">Request failed</p>
          <p className="mt-0.5 break-words">{error}</p>
          {sessionId && draft.trim() && !caseClosed ? (
            <Button className="mt-2" onClick={() => void sendDraftMessage()} disabled={controlsDisabled}>
              Retry sending message
            </Button>
          ) : null}
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
            <CustomerSelector
              customers={customers}
              selectedCustomerId={selectedCustomerId}
              onSelect={(customerId) => {
                caseRevision.current += 1
                setSelectedCustomerId(customerId)
                setSessionId(null)
                setDetail(null)
                setEvents([])
                setHandoff(null)
                setSessionEscalated(false)
                setMessages([])
                setNotice(null)
                setError(null)
                localStorage.setItem('casemind-customer', customerId)
              }}
              onStartChat={() => void beginSession()}
              disabled={Boolean(routeCaseId) || controlsDisabled}
              starting={pending === 'session'}
              prominent={shouldShowStartSession}
              continueCase={Boolean(detail && shouldShowStartSession)}
            />
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

          <ChatPanel
            sessionId={sessionId}
            messages={messages}
            draft={draft}
            pending={pending === 'message'}
            hasExistingCase={Boolean(detail)}
            caseStatus={detail?.status ?? (sessionEscalated ? 'escalated' : null)}
            onDraftChange={setDraft}
            onSubmit={submitMessage}
          />
        </section>

        <aside className="min-w-0">
          <ActionCard
            action={activeAction}
            hasSession={Boolean(sessionId)}
            caseStatus={detail?.status ?? null}
            pending={controlsDisabled}
            onOutcome={(outcome) => void submitOutcome(outcome)}
          />

          {sessionEscalated || detail?.status === 'escalated' ? (
            <HandoffSummaryCard handoff={handoff} detail={detail} />
          ) : null}

          <CaseTimeline
            events={events}
            hasCase={Boolean(detail)}
            loading={sessionEscalated && !detail}
          />

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
