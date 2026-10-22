import type {
  ApiErrorEnvelope,
  CaseDetail,
  CaseEvent,
  CaseSummary,
  CaseStatus,
  Customer,
  DashboardMetrics,
  HandoffSummary,
  MessageResponse,
  OutcomeResponse,
  SessionResponse,
} from './types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null

  constructor(message: string, status: number, code: string, requestId: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      `Could not connect to the CaseMind API at ${API_BASE_URL}. Start the backend service and try again.`,
      0,
      'NETWORK_ERROR',
    )
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const payload = body as ApiErrorEnvelope | null
    throw new ApiError(
      payload?.error?.message ?? `The request failed with status ${response.status}.`,
      response.status,
      payload?.error?.code ?? 'HTTP_ERROR',
      payload?.error?.requestId ?? null,
    )
  }

  if (body === null) {
    throw new ApiError('The API returned an empty or invalid JSON response.', response.status, 'INVALID_RESPONSE')
  }
  return body as T
}

export async function getCustomers(signal?: AbortSignal): Promise<Customer[]> {
  const response = await request<{ customers: Customer[] }>('/customers', { signal })
  return response.customers
}

export async function getCases(
  customerId: string,
  statuses: CaseStatus[],
  signal?: AbortSignal,
): Promise<CaseSummary[]> {
  const query = new URLSearchParams({ customerId, status: statuses.join(',') })
  const response = await request<{ cases: CaseSummary[] }>(`/cases?${query.toString()}`, { signal })
  return response.cases
}

export async function getCase(caseId: string, signal?: AbortSignal): Promise<CaseDetail> {
  const response = await request<{ case: CaseDetail }>(`/cases/${encodeURIComponent(caseId)}`, { signal })
  return response.case
}

export async function getCaseTimeline(caseId: string, signal?: AbortSignal): Promise<CaseEvent[]> {
  const response = await request<{ events: CaseEvent[] }>(
    `/cases/${encodeURIComponent(caseId)}/timeline`,
    { signal },
  )
  return response.events
}

export function getDashboardMetrics(signal?: AbortSignal): Promise<DashboardMetrics> {
  return request<DashboardMetrics>('/dashboard/metrics', { signal })
}

export function createSession(customerId: string): Promise<SessionResponse> {
  return request<SessionResponse>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  })
}

export function sendMessage(sessionId: string, message: string): Promise<MessageResponse> {
  return request<MessageResponse>(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export function recordActionOutcome(
  caseId: string,
  actionId: string,
  outcome: 'failed' | 'succeeded' | 'unknown',
): Promise<OutcomeResponse> {
  return request<OutcomeResponse>(
    `/cases/${encodeURIComponent(caseId)}/actions/${encodeURIComponent(actionId)}/outcome`,
    {
      method: 'POST',
      body: JSON.stringify({ outcome }),
    },
  )
}

export async function getHandoffSummary(caseId: string, signal?: AbortSignal): Promise<HandoffSummary> {
  return request<HandoffSummary>(
    `/cases/${encodeURIComponent(caseId)}/handoff-summary`,
    { signal },
  )
}

export async function getAllCases(
  customers: Customer[],
  signal?: AbortSignal,
): Promise<CaseSummary[]> {
  const statuses: CaseStatus[] = ['open', 'in_progress', 'escalated', 'resolved', 'closed']
  const groupedCases = await Promise.all(
    customers.map((customer) => getCases(customer.id, statuses, signal)),
  )
  const unique = new Map<string, CaseSummary>()
  groupedCases.flat().forEach((item) => unique.set(item.id, item))
  return Array.from(unique.values())
}
