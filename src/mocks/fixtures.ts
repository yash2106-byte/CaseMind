import type {
  CaseDetail,
  CaseEvent,
  CaseSummary,
  Customer,
  DashboardMetrics,
  SupportAction,
} from '@/types/api'

export const CUSTOMER_ONE = '11111111-1111-4111-8111-111111111111'
export const CUSTOMER_TWO = '22222222-2222-4222-8222-222222222222'
export const CASE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const SESSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
export const ACTION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
export const NEXT_ACTION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

export const customers: Customer[] = [
  { id: CUSTOMER_ONE, displayName: 'Demo Customer 1' },
  { id: CUSTOMER_TWO, displayName: 'Demo Customer 2' },
]

export const metrics: DashboardMetrics = {
  totalCases: 12,
  openCases: 2,
  escalatedCases: 3,
  resolvedCases: 7,
  repeatContactRate: 0.25,
  repeatedRecommendationRate: 0.125,
}

export const firstAction: SupportAction = {
  id: ACTION_ID,
  caseId: CASE_ID,
  stepKey: 'router_power_cycle',
  stepOrder: 1,
  label: 'Restart your router/modem',
  instructions: 'Turn the router off for 30 seconds, then test the connection.',
  status: 'recommended',
  recommendedAt: '2026-10-18T00:00:00.000Z',
  outcomeAt: null,
  customerNote: null,
}

export const nextAction: SupportAction = {
  id: NEXT_ACTION_ID,
  caseId: CASE_ID,
  stepKey: 'check_cables_lights',
  stepOrder: 2,
  label: 'Check cables and indicator lights',
  instructions: 'Check that power and network cables are firmly connected.',
  status: 'recommended',
  recommendedAt: '2026-10-18T00:02:00.000Z',
  outcomeAt: null,
  customerNote: null,
}

export const failedEvent: CaseEvent = {
  id: 'event-failed',
  caseId: CASE_ID,
  type: 'action_outcome_recorded',
  message: 'Customer marked Restart your router/modem as failed.',
  metadata: { stepKey: firstAction.stepKey, outcome: 'failed' },
  createdAt: '2026-10-18T00:02:00.000Z',
}

export const caseSummary: CaseSummary = {
  id: CASE_ID,
  customerId: CUSTOMER_ONE,
  issueType: 'internet_connectivity',
  title: 'Internet connection not working',
  status: 'in_progress',
  contactCount: 2,
  currentStepKey: firstAction.stepKey,
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:02:00.000Z',
  lastContactAt: '2026-10-18T00:02:00.000Z',
}

export const caseDetail: CaseDetail = {
  ...caseSummary,
  problemSummary: 'Customer reports that the home internet connection is unavailable.',
  resolvedAt: null,
  promisedDeadline: null,
  actions: [firstAction],
  events: [],
  handoffSummary: null,
}

export const escalatedCase: CaseDetail = {
  ...caseDetail,
  status: 'escalated',
  contactCount: 3,
  currentStepKey: null,
  handoffSummary: 'Internet connection not working. Customer contacted support 3 times. Failed steps: Restart your router/modem. Escalation reason: contact limit reached.',
}

export const cases: CaseSummary[] = [caseSummary]

export const handoff = {
  caseId: CASE_ID,
  summary: escalatedCase.handoffSummary!,
  contactCount: 3,
  failedActions: [firstAction.stepKey],
  timeline: [failedEvent],
}
