import type { MessageResponse, SessionResponse } from '@/types/api'
import type { DemoWorkspace } from '@/mocks/mockApi'
import { DEMO_MODE } from '@/lib/config'
import { createDemoSession, openDemoWorkspace, sendDemoMessage } from '@/mocks/mockApi'
import { request } from './client'

export function createSession(customerId: string): Promise<SessionResponse> {
  if (DEMO_MODE) return createDemoSession(customerId)
  return request<SessionResponse>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ customerId }),
  })
}

export function sendMessage(sessionId: string, message: string): Promise<MessageResponse> {
  if (DEMO_MODE) return sendDemoMessage(sessionId, message)
  return request<MessageResponse>(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export function getDemoWorkspace(customerId: string, caseId?: string): Promise<DemoWorkspace | null> {
  if (!DEMO_MODE) return Promise.resolve(null)
  return openDemoWorkspace(customerId, caseId)
}
