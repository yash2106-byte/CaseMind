export type CaseStatus = 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed'
export type ActionStatus = 'recommended' | 'attempted' | 'failed' | 'succeeded' | 'unknown' | 'skipped'
export type ActionOutcome = 'failed' | 'succeeded' | 'unknown'
export type ReplyKind = 'troubleshooting' | 'scope' | 'clarification' | 'escalation'

export interface Customer {
  id: string
  displayName: string
  email?: string | null
  createdAt?: string
}

export interface SupportAction {
  id: string
  caseId: string
  stepKey: string
  stepOrder: number
  label: string
  instructions: string
  status: ActionStatus
  recommendedAt: string
  outcomeAt: string | null
  customerNote: string | null
}

export interface CaseEvent {
  id: string
  caseId: string
  type: string
  message: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface CaseSummary {
  id: string
  customerId: string
  issueType: 'internet_connectivity'
  title: string
  status: CaseStatus
  contactCount: number
  currentStepKey: string | null
  createdAt: string
  updatedAt: string
  lastContactAt: string
}

export interface CaseDetail extends CaseSummary {
  problemSummary: string
  resolvedAt: string | null
  promisedDeadline: string | null
  actions: SupportAction[]
  events: CaseEvent[]
  handoffSummary: string | null
}

export interface DashboardMetrics {
  totalCases: number
  openCases: number
  escalatedCases: number
  resolvedCases: number
  repeatContactRate: number
  repeatedRecommendationRate: number
}

export interface SessionResponse {
  sessionId: string
  customerId: string
  case: CaseSummary | null
  escalationRequired: boolean
  handoffSummary: string | null
}

export interface MessageResponse {
  sessionId: string
  case: CaseDetail | null
  reply: {
    text: string
    kind: ReplyKind
  }
  recommendedAction: SupportAction | null
  needsOutcome: boolean
}

export interface OutcomeResponse {
  case: CaseDetail
  reply: {
    text: string
    kind: ReplyKind
  }
  recommendedAction: SupportAction | null
}

export interface HandoffSummary {
  caseId: string
  summary: string
  contactCount: number
  failedActions: string[]
  timeline: CaseEvent[]
}

export interface ApiErrorEnvelope {
  error: {
    code: string
    message: string
    requestId: string
  }
}
