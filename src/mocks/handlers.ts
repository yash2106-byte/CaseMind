import { http, HttpResponse } from 'msw'
import {
  caseDetail,
  cases,
  customers,
  firstAction,
  handoff,
  metrics,
  SESSION_ID,
} from './fixtures'

const api = '*/api/v1'

export const handlers = [
  http.get(`${api}/customers`, () => HttpResponse.json({ customers })),
  http.get(`${api}/dashboard/metrics`, () => HttpResponse.json(metrics)),
  http.get(`${api}/cases`, ({ request }) => {
    const customerId = new URL(request.url).searchParams.get('customerId')
    return HttpResponse.json({ cases: cases.filter((item) => item.customerId === customerId) })
  }),
  http.get(`${api}/cases/:caseId/timeline`, () => HttpResponse.json({ events: caseDetail.events })),
  http.get(`${api}/cases/:caseId/handoff-summary`, () => HttpResponse.json(handoff)),
  http.get(`${api}/cases/:caseId`, () => HttpResponse.json({ case: caseDetail })),
  http.post(`${api}/sessions`, async ({ request }) => {
    const body = await request.json() as { customerId: string }
    return HttpResponse.json({
      sessionId: SESSION_ID,
      customerId: body.customerId,
      case: null,
      escalationRequired: false,
      handoffSummary: null,
    }, { status: 201 })
  }),
  http.post(`${api}/sessions/:sessionId/messages`, () => HttpResponse.json({
    sessionId: SESSION_ID,
    case: caseDetail,
    reply: { text: 'Let us start by restarting your router.', kind: 'troubleshooting' },
    recommendedAction: firstAction,
    needsOutcome: true,
  })),
  http.post(`${api}/cases/:caseId/actions/:actionId/outcome`, () => HttpResponse.json({
    case: caseDetail,
    reply: { text: 'Thanks for trying that step.', kind: 'troubleshooting' },
    recommendedAction: firstAction,
  })),
]
