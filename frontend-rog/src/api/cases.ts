import type {
  CaseDetail,
  CaseEvent,
  CaseStatus,
  CaseSummary,
  Customer,
  HandoffSummary,
  OutcomeResponse,
} from '@/types/api'
import { DEMO_MODE } from '@/lib/config'
import {
  getDemoCase,
  getDemoCases,
  getDemoHandoff,
  getDemoTimeline,
  recordDemoOutcome,
} from '@/mocks/mockApi'
import { request } from './client'

export async function getCases(
  customerId: string,
  statuses: CaseStatus[],
  signal?: AbortSignal,
): Promise<CaseSummary[]> {
  if (DEMO_MODE) return getDemoCases(customerId, statuses)
  const query = new URLSearchParams({ customerId, status: statuses.join(',') })
  const response = await request<{ cases: CaseSummary[] }>(`/cases?${query.toString()}`, { signal })
  return response.cases
}

export async function getCase(caseId: string, signal?: AbortSignal): Promise<CaseDetail> {
  if (DEMO_MODE) return getDemoCase(caseId)
  const response = await request<{ case: CaseDetail }>(`/cases/${encodeURIComponent(caseId)}`, { signal })
  return response.case
}

export async function getCaseTimeline(caseId: string, signal?: AbortSignal): Promise<CaseEvent[]> {
  if (DEMO_MODE) return getDemoTimeline(caseId)
  const response = await request<{ events: CaseEvent[] }>(
    `/cases/${encodeURIComponent(caseId)}/timeline`,
    { signal },
  )
  return response.events
}

export function recordActionOutcome(
  caseId: string,
  actionId: string,
  outcome: 'failed' | 'succeeded' | 'unknown',
  customerNote?: string,
): Promise<OutcomeResponse> {
  if (DEMO_MODE) return recordDemoOutcome(caseId, actionId, outcome, customerNote)
  return request<OutcomeResponse>(
    `/cases/${encodeURIComponent(caseId)}/actions/${encodeURIComponent(actionId)}/outcome`,
    {
      method: 'POST',
      body: JSON.stringify({ outcome }),
    },
  )
}

export function getHandoffSummary(caseId: string, signal?: AbortSignal): Promise<HandoffSummary> {
  if (DEMO_MODE) return getDemoHandoff(caseId)
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
