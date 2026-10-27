import type { CaseDetail, CaseEvent, Customer, HandoffSummary, SupportAction } from '@/types/api'

export const DEMO_CUSTOMERS: Customer[] = [
  { id: '11111111-1111-4111-8111-111111111111', displayName: 'Aarav Sharma', email: 'aarav.demo@example.com', createdAt: '2026-10-20T09:00:00.000Z' },
  { id: '22222222-2222-4222-8222-222222222222', displayName: 'Priya Das', email: 'priya.demo@example.com', createdAt: '2026-10-20T09:05:00.000Z' },
  { id: '33333333-3333-4333-8333-333333333333', displayName: 'Rohan Mehta', email: 'rohan.demo@example.com', createdAt: '2026-10-20T09:10:00.000Z' },
]

export const DEMO_INITIAL_MESSAGES: Record<string, string> = {
  '11111111-1111-4111-8111-111111111111': "My Wi-Fi is connected, but I can't open any websites.",
  '22222222-2222-4222-8222-222222222222': 'The internet is still disconnecting. I already restarted the router yesterday.',
  '33333333-3333-4333-8333-333333333333': "This is my third time contacting support. My internet still doesn't work, and I need it for an important meeting.",
}

export const DEMO_ACTION_SEEDS: SupportAction[] = [
  {
    id: '10000001-0000-4000-8000-000000000001',
    caseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    stepKey: 'router_power_cycle',
    stepOrder: 1,
    label: 'Restart your router/modem',
    instructions: 'Turn the router/modem off, keep it off for 30 seconds, then turn it back on. Wait for the indicator lights to stabilize and test the connection.',
    status: 'recommended',
    recommendedAt: '2026-10-20T09:03:00.000Z',
    outcomeAt: null,
    customerNote: null,
  },
  {
    id: '20000001-0000-4000-8000-000000000001',
    caseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    stepKey: 'router_power_cycle',
    stepOrder: 1,
    label: 'Restart your router/modem',
    instructions: 'Turn the router/modem off, keep it off for 30 seconds, then turn it back on. Wait for the indicator lights to stabilize and test the connection.',
    status: 'failed',
    recommendedAt: '2026-10-19T13:12:00.000Z',
    outcomeAt: '2026-10-19T13:18:00.000Z',
    customerNote: 'The internet disconnected again.',
  },
  {
    id: '20000002-0000-4000-8000-000000000002',
    caseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    stepKey: 'check_cables_lights',
    stepOrder: 2,
    label: 'Check cables and indicator lights',
    instructions: 'Check that power and network cables are firmly connected. Note any warning/red lights. Do not ask the customer to open equipment.',
    status: 'recommended',
    recommendedAt: '2026-10-20T10:04:00.000Z',
    outcomeAt: null,
    customerNote: null,
  },
  {
    id: '30000001-0000-4000-8000-000000000001',
    caseId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    stepKey: 'router_power_cycle',
    stepOrder: 1,
    label: 'Restart your router/modem',
    instructions: 'Turn the router/modem off, keep it off for 30 seconds, then turn it back on. Wait for the indicator lights to stabilize and test the connection.',
    status: 'failed',
    recommendedAt: '2026-10-18T08:02:00.000Z',
    outcomeAt: '2026-10-18T08:10:00.000Z',
    customerNote: 'The internet is still unavailable.',
  },
  {
    id: '30000002-0000-4000-8000-000000000002',
    caseId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    stepKey: 'check_cables_lights',
    stepOrder: 2,
    label: 'Check cables and indicator lights',
    instructions: 'Check that power and network cables are firmly connected. Note any warning/red lights. Do not ask the customer to open equipment.',
    status: 'failed',
    recommendedAt: '2026-10-18T08:15:00.000Z',
    outcomeAt: '2026-10-18T08:22:00.000Z',
    customerNote: 'Cables are connected; the warning light remains on.',
  },
]

function event(
  id: string,
  caseId: string,
  type: string,
  message: string,
  createdAt: string,
  metadata: Record<string, unknown> = {},
): CaseEvent {
  return { id, caseId, type, message, createdAt, metadata }
}

export const DEMO_CASE_SEEDS: CaseDetail[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    customerId: '11111111-1111-4111-8111-111111111111',
    issueType: 'internet_connectivity',
    title: 'Internet connection not working',
    problemSummary: 'Wi-Fi connects successfully, but websites and online services do not load.',
    status: 'in_progress',
    contactCount: 1,
    currentStepKey: 'router_power_cycle',
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:03:00.000Z',
    lastContactAt: '2026-10-20T09:00:00.000Z',
    resolvedAt: null,
    promisedDeadline: null,
    actions: [DEMO_ACTION_SEEDS[0]],
    events: [
      event('a1000001-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'case_created', 'Case created: Internet connection not working.', '2026-10-20T09:00:00.000Z'),
      event('a1000002-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'contact_started', 'Customer contacted support.', '2026-10-20T09:00:00.000Z'),
      event('a1000003-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'message_received', "Customer: My Wi-Fi is connected, but I can't open any websites.", '2026-10-20T09:01:00.000Z'),
      event('a1000004-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'action_recommended', 'Recommended: Restart your router/modem.', '2026-10-20T09:03:00.000Z', { stepKey: 'router_power_cycle' }),
    ],
    handoffSummary: null,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    customerId: '22222222-2222-4222-8222-222222222222',
    issueType: 'internet_connectivity',
    title: 'Internet disconnects repeatedly',
    problemSummary: 'Connection drops frequently and restarting the router did not resolve the issue.',
    status: 'in_progress',
    contactCount: 2,
    currentStepKey: 'check_cables_lights',
    createdAt: '2026-10-19T13:00:00.000Z',
    updatedAt: '2026-10-20T10:04:00.000Z',
    lastContactAt: '2026-10-20T10:00:00.000Z',
    resolvedAt: null,
    promisedDeadline: null,
    actions: [DEMO_ACTION_SEEDS[1], DEMO_ACTION_SEEDS[2]],
    events: [
      event('b1000001-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'case_created', 'Case created: Internet disconnects repeatedly.', '2026-10-19T13:00:00.000Z'),
      event('b1000002-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'contact_started', 'Customer contacted support.', '2026-10-19T13:00:00.000Z'),
      event('b1000003-0000-4000-8000-000000000003', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'action_recommended', 'Recommended: Restart your router/modem.', '2026-10-19T13:12:00.000Z', { stepKey: 'router_power_cycle' }),
      event('b1000004-0000-4000-8000-000000000004', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'action_outcome_recorded', 'Customer marked Restart your router/modem as failed.', '2026-10-19T13:18:00.000Z', { stepKey: 'router_power_cycle', outcome: 'failed' }),
      event('b1000005-0000-4000-8000-000000000005', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'contact_started', 'Customer started a second support contact.', '2026-10-20T10:00:00.000Z'),
      event('b1000006-0000-4000-8000-000000000006', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'message_received', 'Customer: The internet is still disconnecting. I already restarted the router yesterday.', '2026-10-20T10:01:00.000Z'),
      event('b1000007-0000-4000-8000-000000000007', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'action_recommended', 'Recommended: Check cables and indicator lights.', '2026-10-20T10:04:00.000Z', { stepKey: 'check_cables_lights' }),
    ],
    handoffSummary: null,
  },
  {
    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    customerId: '33333333-3333-4333-8333-333333333333',
    issueType: 'internet_connectivity',
    title: 'Complete internet outage',
    problemSummary: 'Internet remains unavailable after multiple troubleshooting attempts and repeated contacts.',
    status: 'escalated',
    contactCount: 3,
    currentStepKey: null,
    createdAt: '2026-10-18T08:00:00.000Z',
    updatedAt: '2026-10-18T09:00:00.000Z',
    lastContactAt: '2026-10-18T09:00:00.000Z',
    resolvedAt: null,
    promisedDeadline: null,
    actions: [DEMO_ACTION_SEEDS[3], DEMO_ACTION_SEEDS[4]],
    events: [
      event('c1000001-0000-4000-8000-000000000001', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'case_created', 'Case created: Complete internet outage.', '2026-10-18T08:00:00.000Z'),
      event('c1000002-0000-4000-8000-000000000002', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'contact_started', 'Customer contacted support.', '2026-10-18T08:00:00.000Z'),
      event('c1000003-0000-4000-8000-000000000003', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'action_outcome_recorded', 'Customer marked Restart your router/modem as failed.', '2026-10-18T08:10:00.000Z', { stepKey: 'router_power_cycle', outcome: 'failed' }),
      event('c1000004-0000-4000-8000-000000000004', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'action_recommended', 'Recommended: Check cables and indicator lights.', '2026-10-18T08:15:00.000Z', { stepKey: 'check_cables_lights' }),
      event('c1000005-0000-4000-8000-000000000005', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'action_outcome_recorded', 'Customer marked Check cables and indicator lights as failed.', '2026-10-18T08:22:00.000Z', { stepKey: 'check_cables_lights', outcome: 'failed' }),
      event('c1000006-0000-4000-8000-000000000006', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'contact_started', 'Customer started a third support contact.', '2026-10-18T09:00:00.000Z'),
      event('c1000007-0000-4000-8000-000000000007', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'message_received', "Customer: This is my third time contacting support. My internet still doesn't work, and I need it for an important meeting.", '2026-10-18T09:01:00.000Z'),
      event('c1000008-0000-4000-8000-000000000008', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'case_escalated', 'Case escalated after the third contact (contact_limit_reached).', '2026-10-18T09:00:00.000Z', { reason: 'contact_limit_reached' }),
      event('c1000009-0000-4000-8000-000000000009', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'summary_generated', 'Simulated handoff summary generated.', '2026-10-18T09:00:00.000Z'),
    ],
    handoffSummary: 'SIMULATED HANDOFF: Complete internet outage remains unresolved after three contacts. Router restart and cable checks failed. Escalation reason: contact_limit_reached. Human support follow-up is required.',
  },
]

export function createDemoSeed(): CaseDetail[] {
  return structuredClone(DEMO_CASE_SEEDS)
}

export function makeHandoffSummary(caseDetail: CaseDetail, reason: string): string {
  const failed = caseDetail.actions.filter((action) => action.status === 'failed').map((action) => action.label)
  const failedText = failed.length ? failed.join(' and ') : 'No troubleshooting actions have failed yet'
  const reasonText = reason === 'contact_limit_reached' ? 'contact limit reached' : 'troubleshooting playbook exhausted'
  return `${caseDetail.title} remains unresolved after ${caseDetail.contactCount} contacts. ${failedText}. Escalation reason: ${reasonText}. Human support follow-up is required.`
}

export function createHandoff(caseDetail: CaseDetail): HandoffSummary {
  return {
    caseId: caseDetail.id,
    summary: caseDetail.handoffSummary ?? '',
    contactCount: caseDetail.contactCount,
    failedActions: caseDetail.actions.filter((action) => action.status === 'failed').map((action) => action.stepKey),
    timeline: structuredClone(caseDetail.events),
  }
}
