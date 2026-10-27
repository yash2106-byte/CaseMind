import type {
  CaseDetail,
  CaseEvent,
  CaseStatus,
  CaseSummary,
  Customer,
  DashboardMetrics,
  HandoffSummary,
  MessageResponse,
  OutcomeResponse,
  ReplyKind,
  SessionResponse,
  SupportAction,
} from '@/types/api'
import type { ChatMessage } from '@/types/chat'
import {
  createDemoSeed,
  createHandoff,
  DEMO_CUSTOMERS,
  DEMO_INITIAL_MESSAGES,
  makeHandoffSummary,
} from './demoSeed'

const PLAYBOOK = [
  {
    stepKey: 'router_power_cycle',
    label: 'Restart your router/modem',
    instructions: 'Turn the router/modem off, keep it off for 30 seconds, then turn it back on. Wait for the indicator lights to stabilize and test the connection.',
  },
  {
    stepKey: 'check_cables_lights',
    label: 'Check cables and indicator lights',
    instructions: 'Check that power and network cables are firmly connected. Note any warning/red lights. Do not ask the customer to open equipment.',
  },
  {
    stepKey: 'check_area_outage',
    label: 'Check for an area outage',
    instructions: 'Demo simulation: No known outage in this demo. No real ISP status was checked.',
  },
  {
    stepKey: 'test_another_device',
    label: 'Test another device or wired connection',
    instructions: 'Try another device on the same network, or test with Ethernet if available. This helps determine whether the issue affects one device or the whole connection.',
  },
  {
    stepKey: 'remote_line_reset',
    label: 'Run a remote line reset',
    instructions: 'Demo simulation: a remote line reset would be requested here. No real reset occurs.',
  },
  {
    stepKey: 'book_technician',
    label: 'Arrange a technician visit',
    instructions: 'Demo simulation: a technician visit would be requested here. No booking occurs.',
  },
] as const

let cases = createDemoSeed()
let sequence = 1
let sessionCounter = 1

interface DemoSession {
  customerId: string
  caseId: string | null
}

export interface DemoWorkspace {
  caseDetail: CaseDetail | null
  sessionId: string | null
  messages: ChatMessage[]
}

const sessions = new Map<string, DemoSession>()
const transcripts = new Map<string, ChatMessage[]>()

function clone<T>(value: T): T {
  return structuredClone(value)
}

function createId(): string {
  const suffix = (sequence++).toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${suffix}`
}

function now(): string {
  return new Date().toISOString()
}

function appendEvent(
  item: CaseDetail,
  type: string,
  message: string,
  metadata: Record<string, unknown> = {},
  createdAt = now(),
): CaseEvent {
  const next: CaseEvent = {
    id: createId(),
    caseId: item.id,
    type,
    message,
    metadata,
    createdAt,
  }
  item.events.push(next)
  item.updatedAt = createdAt
  return next
}

function summary(item: CaseDetail): CaseSummary {
  const {
    problemSummary: _problemSummary,
    resolvedAt: _resolvedAt,
    promisedDeadline: _promisedDeadline,
    actions: _actions,
    events: _events,
    handoffSummary: _handoffSummary,
    ...caseSummary
  } = item
  return caseSummary
}

function findCase(caseId: string): CaseDetail {
  const item = cases.find((candidate) => candidate.id === caseId)
  if (!item) throw new Error(`Demo case not found: ${caseId}`)
  return item
}

function findCustomer(customerId: string): Customer {
  const customer = DEMO_CUSTOMERS.find((candidate) => candidate.id === customerId)
  if (!customer) throw new Error(`Demo customer not found: ${customerId}`)
  return customer
}

function activeAction(item: CaseDetail): SupportAction | null {
  if (!['open', 'in_progress'].includes(item.status)) return null
  return item.actions.find((action) => ['recommended', 'attempted', 'unknown'].includes(action.status)) ?? null
}

function pushMessage(sessionId: string, role: ChatMessage['role'], text: string, kind?: ReplyKind): void {
  const transcript = transcripts.get(sessionId) ?? []
  transcript.push({ id: createId(), role, text, kind, createdAt: now() })
  transcripts.set(sessionId, transcript)
}

function createSessionId(): string {
  const suffix = (sessionCounter++).toString(16).padStart(12, '0')
  return `90000000-0000-4000-8000-${suffix}`
}

function initialTranscript(item: CaseDetail): ChatMessage[] {
  const initialText = DEMO_INITIAL_MESSAGES[item.customerId]
  const initialEvent = item.events.find((event) => event.type === 'message_received')
  return initialText
    ? [{
        id: initialEvent?.id ?? createId(),
        role: 'customer',
        text: initialText,
        createdAt: initialEvent?.createdAt ?? item.createdAt,
      }]
    : []
}

function getSeedSession(customerId: string): string | null {
  const item = cases.find((candidate) => candidate.customerId === customerId)
  if (!item || !['open', 'in_progress'].includes(item.status)) return null
  const sessionId = `80000000-0000-4000-8000-${item.id.slice(0, 12)}`
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { customerId, caseId: item.id })
    transcripts.set(sessionId, initialTranscript(item))
  }
  return sessionId
}

function recommendNextAction(item: CaseDetail): SupportAction | null {
  const unavailable = new Set(
    item.actions
      .filter((action) => action.status === 'failed' || action.status === 'succeeded')
      .map((action) => action.stepKey),
  )
  const step = PLAYBOOK.find((candidate) => !unavailable.has(candidate.stepKey))
  if (!step) return null
  const next: SupportAction = {
    id: createId(),
    caseId: item.id,
    stepKey: step.stepKey,
    stepOrder: PLAYBOOK.indexOf(step) + 1,
    label: step.label,
    instructions: step.instructions,
    status: 'recommended',
    recommendedAt: now(),
    outcomeAt: null,
    customerNote: null,
  }
  item.actions.push(next)
  item.currentStepKey = next.stepKey
  item.status = 'in_progress'
  appendEvent(item, 'action_recommended', `Recommended: ${next.label}.`, { stepKey: next.stepKey })
  return next
}

function escalate(item: CaseDetail, reason: string): void {
  if (item.status === 'escalated') return
  const createdAt = now()
  item.status = 'escalated'
  item.currentStepKey = null
  item.handoffSummary = makeHandoffSummary(item, reason)
  appendEvent(item, 'case_escalated', `Case escalated. Reason: ${reason}.`, { reason }, createdAt)
  appendEvent(item, 'summary_generated', 'Simulated handoff summary generated.', {}, createdAt)
}

function createNewCase(customerId: string, message: string): CaseDetail {
  const customer = findCustomer(customerId)
  const createdAt = now()
  const item: CaseDetail = {
    id: createId(),
    customerId: customer.id,
    issueType: 'internet_connectivity',
    title: 'Internet connection not working',
    problemSummary: message,
    status: 'open',
    contactCount: 1,
    currentStepKey: null,
    createdAt,
    updatedAt: createdAt,
    lastContactAt: createdAt,
    resolvedAt: null,
    promisedDeadline: null,
    actions: [],
    events: [],
    handoffSummary: null,
  }
  cases.push(item)
  appendEvent(item, 'case_created', `Case created: ${item.title}.`)
  appendEvent(item, 'contact_started', 'Customer contacted support.')
  return item
}

function reply(text: string, kind: ReplyKind): MessageResponse['reply'] {
  return { text, kind }
}

function completeOutcome(
  item: CaseDetail,
  action: SupportAction,
  outcome: 'failed' | 'succeeded' | 'unknown',
  customerNote?: string,
): OutcomeResponse {
  if (['escalated', 'resolved', 'closed'].includes(item.status)) {
    return { case: clone(item), reply: reply('This case is no longer accepting troubleshooting outcomes.', 'escalation'), recommendedAction: null }
  }
  if (action.status === 'failed' || action.status === 'succeeded') {
    if (action.status !== outcome) {
      throw new Error('This action already has a different final outcome.')
    }
    return { case: clone(item), reply: reply('That outcome has already been recorded.', 'troubleshooting'), recommendedAction: activeAction(item) }
  }
  const timestamp = now()
  action.status = outcome
  action.outcomeAt = timestamp
  action.customerNote = customerNote ?? null
  appendEvent(
    item,
    'action_outcome_recorded',
    `Customer marked ${action.label} as ${outcome}.`,
    { stepKey: action.stepKey, outcome },
    timestamp,
  )

  if (outcome === 'succeeded') {
    item.status = 'resolved'
    item.currentStepKey = null
    item.resolvedAt = timestamp
    appendEvent(item, 'case_resolved', 'Customer confirmed the internet connection is working.', {}, timestamp)
    return {
      case: clone(item),
      reply: reply('Thanks for confirming. I have marked this case as resolved.', 'troubleshooting'),
      recommendedAction: null,
    }
  }
  if (outcome === 'unknown') {
    return {
      case: clone(item),
      reply: reply('Please retest this step and tell me whether your internet connection is working. I will keep this step pending until you clarify.', 'clarification'),
      recommendedAction: action,
    }
  }

  const nextAction = recommendNextAction(item)
  if (!nextAction) {
    escalate(item, 'playbook_exhausted')
    return {
      case: clone(item),
      reply: reply('The troubleshooting playbook is exhausted. This case has been escalated for a simulated human follow-up.', 'escalation'),
      recommendedAction: null,
    }
  }
  return {
    case: clone(item),
    reply: reply(`Thanks for checking. I won't recommend that step again for this case. Next, ${nextAction.instructions}`, 'troubleshooting'),
    recommendedAction: clone(nextAction),
  }
}

export function resetDemoState(): void {
  cases = createDemoSeed()
  sequence = 1
  sessionCounter = 1
  sessions.clear()
  transcripts.clear()
}

export async function getDemoCustomers(): Promise<Customer[]> {
  return clone(DEMO_CUSTOMERS)
}

export async function getDemoCases(customerId: string, statuses: CaseStatus[]): Promise<CaseSummary[]> {
  findCustomer(customerId)
  return cases
    .filter((item) => item.customerId === customerId && statuses.includes(item.status))
    .map(summary)
    .map(clone)
}

export async function getDemoCase(caseId: string): Promise<CaseDetail> {
  return clone(findCase(caseId))
}

export async function getDemoTimeline(caseId: string): Promise<CaseEvent[]> {
  return clone(findCase(caseId).events)
}

export async function getDemoHandoff(caseId: string): Promise<HandoffSummary> {
  return createHandoff(findCase(caseId))
}

export async function resetDemo(): Promise<void> {
  resetDemoState()
}

export async function getDemoMetrics(): Promise<DashboardMetrics> {
  const totalCases = cases.length
  const repeatCases = cases.filter((item) => item.contactCount >= 2).length
  const recommendations = cases.flatMap((item) => item.actions)
  const failedStepsByCase = new Map<string, Set<string>>()
  for (const item of cases) {
    failedStepsByCase.set(item.id, new Set(item.actions.filter((action) => action.status === 'failed').map((action) => action.stepKey)))
  }
  const repeated = recommendations.filter((action) => action.status === 'recommended' &&
    failedStepsByCase.get(action.caseId)?.has(action.stepKey)).length
  return {
    totalCases,
    openCases: cases.filter((item) => item.status === 'open' || item.status === 'in_progress').length,
    escalatedCases: cases.filter((item) => item.status === 'escalated').length,
    resolvedCases: cases.filter((item) => item.status === 'resolved').length,
    repeatContactRate: totalCases ? repeatCases / totalCases : 0,
    repeatedRecommendationRate: recommendations.length ? repeated / recommendations.length : 0,
  }
}

export async function openDemoWorkspace(customerId: string, requestedCaseId?: string): Promise<DemoWorkspace> {
  findCustomer(customerId)
  const item = requestedCaseId
    ? findCase(requestedCaseId)
    : cases.find((candidate) => candidate.customerId === customerId) ?? null
  if (item && item.customerId !== customerId) throw new Error('Demo case does not belong to the selected customer.')
  const sessionId = item && ['open', 'in_progress'].includes(item.status) ? getSeedSession(customerId) : null
  return {
    caseDetail: item ? clone(item) : null,
    sessionId,
    messages: item && sessionId ? clone(transcripts.get(sessionId) ?? initialTranscript(item)) : item ? initialTranscript(item) : [],
  }
}

export async function createDemoSession(customerId: string): Promise<SessionResponse> {
  findCustomer(customerId)
  const existing = cases
    .filter((item) => item.customerId === customerId && ['open', 'in_progress'].includes(item.status))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0]
  const sessionId = createSessionId()
  sessions.set(sessionId, { customerId, caseId: existing?.id ?? null })
  transcripts.set(sessionId, [])

  if (!existing) {
    return { sessionId, customerId, case: null, escalationRequired: false, handoffSummary: null }
  }

  existing.contactCount += 1
  existing.lastContactAt = now()
  appendEvent(existing, 'contact_started', `Customer started support contact ${existing.contactCount}.`)
  if (existing.contactCount >= 3) {
    escalate(existing, 'contact_limit_reached')
  }
  sessions.set(sessionId, { customerId, caseId: existing.id })
  transcripts.set(sessionId, initialTranscript(existing))
  return {
    sessionId,
    customerId,
    case: summary(existing),
    escalationRequired: existing.status === 'escalated',
    handoffSummary: existing.handoffSummary,
  }
}

export async function sendDemoMessage(sessionId: string, message: string): Promise<MessageResponse> {
  const session = sessions.get(sessionId)
  if (!session) throw new Error('Demo session not found.')
  const text = message.trim()
  if (!text) throw new Error('Message cannot be empty.')
  pushMessage(sessionId, 'customer', text)

  let item = session.caseId ? findCase(session.caseId) : null
  if (item) appendEvent(item, 'message_received', `Customer: ${text}`)
  const connectivity = /\b(internet|wifi|wi-fi|router|modem|connection|connectivity|network|broadband|websites?|online|outage|disconnect)\b/i.test(text)
  if (!connectivity) {
    const scopeReply = 'I can currently help only with internet-connectivity issues. Please describe the internet problem you are experiencing.'
    pushMessage(sessionId, 'assistant', scopeReply, 'scope')
    if (item) appendEvent(item, 'assistant_response', scopeReply)
    return {
      sessionId,
      case: item ? clone(item) : null,
      reply: reply(scopeReply, 'scope'),
      recommendedAction: item ? activeAction(item) : null,
      needsOutcome: false,
    }
  }

  if (item && !['open', 'in_progress'].includes(item.status)) {
    const noMoreReply = 'Automated troubleshooting has stopped for this case. Start a new chat to report a different issue.'
    pushMessage(sessionId, 'assistant', noMoreReply, 'escalation')
    return { sessionId, case: clone(item), reply: reply(noMoreReply, 'escalation'), recommendedAction: null, needsOutcome: false }
  }
  if (!item) {
    item = createNewCase(session.customerId, text)
    session.caseId = item.id
    appendEvent(item, 'message_received', `Customer: ${text}`)
  }
  item.problemSummary = text
  const action = activeAction(item) ?? recommendNextAction(item)
  const assistantText = action
    ? action.instructions
    : 'Could you tell me a little more about what is happening with your internet connection?'
  const kind: ReplyKind = action ? 'troubleshooting' : 'clarification'
  appendEvent(item, 'assistant_response', assistantText)
  pushMessage(sessionId, 'assistant', assistantText, kind)
  return {
    sessionId,
    case: clone(item),
    reply: reply(assistantText, kind),
    recommendedAction: action ? clone(action) : null,
    needsOutcome: Boolean(action),
  }
}

export async function recordDemoOutcome(
  caseId: string,
  actionId: string,
  outcome: 'failed' | 'succeeded' | 'unknown',
  customerNote?: string,
): Promise<OutcomeResponse> {
  const item = findCase(caseId)
  const action = item.actions.find((candidate) => candidate.id === actionId)
  if (!action) throw new Error('Demo action not found.')
  return completeOutcome(item, action, outcome, customerNote)
}
