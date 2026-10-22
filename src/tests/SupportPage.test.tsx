import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SupportPage } from '@/pages/SupportPage'
import { server } from '@/mocks/server'
import {
  CASE_ID,
  CUSTOMER_ONE,
  CUSTOMER_TWO,
  SESSION_ID,
  caseDetail,
  caseSummary,
  escalatedCase,
  failedEvent,
  firstAction,
  handoff,
  nextAction,
} from '@/mocks/fixtures'

const api = '*/api/v1'

function renderSupport(initialEntry = '/support') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/support" element={<SupportPage />} />
        <Route path="/cases/:caseId" element={<SupportPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function startChat(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('option', { name: 'Demo Customer 1' })
  await user.click(screen.getByRole('button', { name: /start new chat/i }))
  await screen.findByText(/New support session started/)
}

async function sendFirstMessage(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Message' }), 'My internet is not working')
  await user.click(screen.getByRole('button', { name: 'Send message' }))
}

afterEach(() => {
  vi.useRealTimers()
})

describe('SupportPage', () => {
  it('loads customers, allows selection, and starts a session for the selected customer', async () => {
    const user = userEvent.setup()
    let sessionCustomerId: string | null = null
    server.use(
      http.post(`${api}/sessions`, async ({ request }) => {
        const body = await request.json() as { customerId: string }
        sessionCustomerId = body.customerId
        return HttpResponse.json({
          sessionId: SESSION_ID,
          customerId: body.customerId,
          case: null,
          escalationRequired: false,
          handoffSummary: null,
        })
      }),
    )
    renderSupport()

    const selector = await screen.findByRole('combobox', { name: 'Demo customer' })
    expect(within(selector).getByRole('option', { name: 'Demo Customer 2' })).toBeInTheDocument()
    await user.selectOptions(selector, CUSTOMER_TWO)
    await user.click(screen.getByRole('button', { name: /start new chat/i }))

    await screen.findByText(/New support session started/)
    expect(sessionCustomerId).toBe(CUSTOMER_TWO)
  })

  it('disables Send while a message request is pending and renders the returned reply and action', async () => {
    const user = userEvent.setup()
    let finishRequest: (() => void) | undefined
    server.use(
      http.post(`${api}/sessions/:sessionId/messages`, async () => {
        await new Promise<void>((resolve) => { finishRequest = resolve })
        return HttpResponse.json({
          sessionId: SESSION_ID,
          case: caseDetail,
          reply: { text: 'Let us start by restarting your router.', kind: 'troubleshooting' },
          recommendedAction: firstAction,
          needsOutcome: true,
        })
      }),
    )
    renderSupport()
    await startChat(user)
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'My internet is down')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    await act(async () => finishRequest?.())
    expect(await screen.findByText('Let us start by restarting your router.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: firstAction.label })).toBeInTheDocument()
  })

  it('shows the backend-returned next action and failed history after an action fails', async () => {
    const user = userEvent.setup()
    const failedAction = { ...firstAction, status: 'failed' as const, outcomeAt: failedEvent.createdAt }
    const afterFailure = {
      ...caseDetail,
      currentStepKey: nextAction.stepKey,
      actions: [failedAction, nextAction],
      events: [failedEvent],
    }
    let outcomeRecorded = false
    server.use(
      http.post(`${api}/cases/:caseId/actions/:actionId/outcome`, () => {
        outcomeRecorded = true
        return HttpResponse.json({
          case: afterFailure,
          reply: { text: 'Thanks for checking. Let us check the cables next.', kind: 'troubleshooting' },
          recommendedAction: nextAction,
        })
      }),
      http.get(`${api}/cases/:caseId`, () => HttpResponse.json({
        case: outcomeRecorded ? afterFailure : caseDetail,
      })),
      http.get(`${api}/cases/:caseId/timeline`, () => HttpResponse.json({
        events: outcomeRecorded ? [failedEvent] : [],
      })),
    )
    renderSupport()
    await startChat(user)
    await sendFirstMessage(user)
    await user.click(await screen.findByRole('button', { name: 'Failed' }))

    expect(await screen.findByRole('heading', { name: nextAction.label })).toBeInTheDocument()
    expect(screen.getByText(failedEvent.message)).toBeInTheDocument()
    expect(screen.getByText('Action outcome recorded')).toBeInTheDocument()
  })

  it('shows resolved state and removes outcome controls after success', async () => {
    const user = userEvent.setup()
    const resolved = {
      ...caseDetail,
      status: 'resolved' as const,
      currentStepKey: null,
      resolvedAt: '2026-10-18T00:04:00.000Z',
      actions: [{ ...firstAction, status: 'succeeded' as const, outcomeAt: '2026-10-18T00:04:00.000Z' }],
    }
    let outcomeRecorded = false
    server.use(
      http.post(`${api}/cases/:caseId/actions/:actionId/outcome`, () => {
        outcomeRecorded = true
        return HttpResponse.json({
          case: resolved,
          reply: { text: 'Your internet connection is working again.', kind: 'troubleshooting' },
          recommendedAction: null,
        })
      }),
      http.get(`${api}/cases/:caseId`, () => HttpResponse.json({
        case: outcomeRecorded ? resolved : caseDetail,
      })),
    )
    renderSupport()
    await startChat(user)
    await sendFirstMessage(user)
    await user.click(await screen.findByRole('button', { name: 'Succeeded' }))

    expect(await screen.findByText('The backend has resolved this case. No further action is pending.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Failed' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Not sure / Unknown' })).not.toBeInTheDocument()
  })

  it('keeps the same action pending clarification for an unknown outcome', async () => {
    const user = userEvent.setup()
    const unknown = {
      ...caseDetail,
      actions: [{ ...firstAction, status: 'unknown' as const, outcomeAt: '2026-10-18T00:04:00.000Z' }],
    }
    let outcomeRecorded = false
    server.use(
      http.post(`${api}/cases/:caseId/actions/:actionId/outcome`, () => {
        outcomeRecorded = true
        return HttpResponse.json({
          case: unknown,
          reply: { text: 'Could you retest and tell me whether the connection is working?', kind: 'clarification' },
          recommendedAction: firstAction,
        })
      }),
      http.get(`${api}/cases/:caseId`, () => HttpResponse.json({
        case: outcomeRecorded ? unknown : caseDetail,
      })),
    )
    renderSupport()
    await startChat(user)
    await sendFirstMessage(user)
    await user.click(await screen.findByRole('button', { name: 'Not sure / Unknown' }))

    expect(await screen.findByText('This action is still awaiting clarification. The backend has not advanced to a different step.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: firstAction.label })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: nextAction.label })).not.toBeInTheDocument()
    expect(screen.getByText('Needs clarification')).toBeInTheDocument()
  })

  it('shows third-contact escalation, failed step labels, contact count, and simulated handoff notice', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${api}/sessions`, () => HttpResponse.json({
        sessionId: SESSION_ID,
        customerId: CUSTOMER_ONE,
        case: {
          ...escalatedCase,
          actions: [{ ...firstAction, status: 'failed' as const }],
          events: [failedEvent],
        },
        escalationRequired: true,
        handoffSummary: handoff.summary,
      })),
      http.get(`${api}/cases/:caseId`, () => HttpResponse.json({
        case: {
          ...escalatedCase,
          actions: [{ ...firstAction, status: 'failed' as const }],
          events: [failedEvent],
        },
      })),
      http.get(`${api}/cases/:caseId/timeline`, () => HttpResponse.json({ events: [failedEvent] })),
    )
    renderSupport()
    await screen.findByRole('option', { name: 'Demo Customer 1' })
    await user.click(screen.getByRole('button', { name: /start new chat/i }))

    expect(await screen.findByText('This is a simulated handoff. No live human agent has been notified.')).toBeInTheDocument()
    expect(screen.getByText('Contacts:')).toBeInTheDocument()
    expect(screen.getByText('Restart your router/modem', { selector: 'li' })).toBeInTheDocument()
    expect(screen.getByText('Third contact reached the contact limit')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Failed' })).not.toBeInTheDocument()
  })

  it('preserves a failed message draft and provides a retry action', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${api}/sessions/:sessionId/messages`, () => HttpResponse.json({
        error: { code: 'AI_UNAVAILABLE', message: 'The assistant is temporarily unavailable. Please try again.', requestId: 'req-example' },
      }, { status: 503 })),
    )
    renderSupport()
    await startChat(user)
    const input = screen.getByRole('textbox', { name: 'Message' })
    await user.type(input, 'My internet connection is down')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText(/req-example/)).toBeInTheDocument()
    expect(input).toHaveValue('My internet connection is down')
    expect(screen.getByRole('button', { name: 'Retry sending message' })).toBeEnabled()
  })

  it('displays validation errors with their request ID and keeps session creation retryable', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${api}/sessions`, () => HttpResponse.json({
        error: { code: 'VALIDATION_ERROR', message: 'customerId must be a valid UUID', requestId: 'req-validation' },
      }, { status: 400 })),
    )
    renderSupport()
    await screen.findByRole('option', { name: 'Demo Customer 1' })
    await user.click(screen.getByRole('button', { name: /start new chat/i }))

    expect(await screen.findByText(/customerId must be a valid UUID/)).toBeInTheDocument()
    expect(screen.getByText(/req-validation/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start new chat/i })).toBeEnabled()
  })

  it('shows an actionable network error when the customer API is unavailable', async () => {
    server.use(http.get(`${api}/customers`, () => HttpResponse.error()))
    renderSupport()

    expect(await screen.findByText('Could not load the support workspace')).toBeInTheDocument()
    expect(screen.getByText(/Could not connect to the CaseMind API/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('labels mocked external ISP steps as simulations', async () => {
    const user = userEvent.setup()
    const mockedAction = {
      ...firstAction,
      stepKey: 'check_area_outage',
      label: 'Check for an area outage',
      stepOrder: 3,
    }
    const mockedCase = { ...caseDetail, actions: [mockedAction] }
    server.use(
      http.post(`${api}/sessions/:sessionId/messages`, () => HttpResponse.json({
        sessionId: SESSION_ID,
        case: mockedCase,
        reply: { text: 'The demo has no known outage.', kind: 'troubleshooting' },
        recommendedAction: mockedAction,
        needsOutcome: true,
      })),
      http.get(`${api}/cases/:caseId`, () => HttpResponse.json({ case: mockedCase })),
    )
    renderSupport()
    await startChat(user)
    await sendFirstMessage(user)

    expect(await screen.findByText('Demo simulation — no real ISP action is performed.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: mockedAction.label })).toBeInTheDocument()
  })

  it('shows escalation reason from a playbook-exhaustion handoff', async () => {
    const exhaustedSummary = 'All troubleshooting steps have been used. Escalation reason: playbook exhausted.'
    server.use(http.get(`${api}/cases/:caseId/handoff-summary`, () => HttpResponse.json({
      ...handoff,
      summary: exhaustedSummary,
    })), http.get(`${api}/cases/:caseId`, () => HttpResponse.json({ case: escalatedCase })))
    renderSupport(`/cases/${CASE_ID}`)

    expect(await screen.findByText('Troubleshooting playbook exhausted')).toBeInTheDocument()
  })

  it.each([
    {
      kind: 'scope',
      text: 'I can currently help only with internet-connectivity issues. Please describe the internet problem you are experiencing.',
    },
    {
      kind: 'clarification',
      text: 'Are you having a problem with your home internet connection?',
    },
  ])('shows the backend $kind reply without creating a local case', async ({ kind, text }) => {
    const user = userEvent.setup()
    server.use(
      http.post(`${api}/sessions/:sessionId/messages`, () => HttpResponse.json({
        sessionId: SESSION_ID,
        case: null,
        reply: { text, kind },
        recommendedAction: null,
        needsOutcome: false,
      })),
    )
    renderSupport()
    await startChat(user)
    await sendFirstMessage(user)

    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByText(CASE_ID)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: firstAction.label })).not.toBeInTheDocument()
  })

  it('resumes a returning customer case with the backend contact count and previous failed action', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(`${api}/sessions`, () => HttpResponse.json({
        sessionId: SESSION_ID,
        customerId: CUSTOMER_ONE,
        case: caseSummary,
        escalationRequired: false,
        handoffSummary: null,
      })),
      http.get(`${api}/cases/:caseId/timeline`, () => HttpResponse.json({ events: [failedEvent] })),
    )
    renderSupport()
    await screen.findByRole('option', { name: 'Demo Customer 1' })
    await user.click(screen.getByRole('button', { name: /start new chat/i }))

    expect(await screen.findByText('Existing case resumed. Previous actions and outcomes are shown below.')).toBeInTheDocument()
    expect(screen.getByText('2', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText(failedEvent.message)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: firstAction.label })).toBeInTheDocument()
  })

  it('ignores a case refresh that completes after the customer selection changes', async () => {
    const user = userEvent.setup()
    let releaseRefresh: (() => void) | undefined
    let caseRequests = 0
    server.use(
      http.get(`${api}/cases/:caseId`, async () => {
        caseRequests += 1
        await new Promise<void>((resolve) => { releaseRefresh = resolve })
        return HttpResponse.json({ case: caseDetail })
      }),
    )
    renderSupport()
    await startChat(user)
    await sendFirstMessage(user)
    await waitFor(() => expect(caseRequests).toBeGreaterThan(0))

    await user.selectOptions(screen.getByRole('combobox', { name: 'Demo customer' }), CUSTOMER_TWO)
    await act(async () => releaseRefresh?.())
    await waitFor(() => expect(screen.queryByText(CASE_ID)).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Internet connectivity' })).toBeInTheDocument()
  })

  it('uses only the public CaseMind API and never requests an AI-service endpoint', async () => {
    const user = userEvent.setup()
    const requestedUrls: string[] = []
    const listener = ({ request }: { request: Request }) => requestedUrls.push(request.url)
    server.events.on('request:start', listener)
    try {
      renderSupport()
      await startChat(user)
      await sendFirstMessage(user)
      await screen.findByText('Let us start by restarting your router.')

      expect(requestedUrls.length).toBeGreaterThan(0)
      expect(requestedUrls.every((url) => url.includes('/api/v1/'))).toBe(true)
      expect(requestedUrls.some((url) => url.includes('/internal/v1') || url.includes(':8000'))).toBe(false)
    } finally {
      server.events.removeListener('request:start', listener)
    }
  })
})
