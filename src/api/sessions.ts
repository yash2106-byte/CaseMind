import type { MessageResponse, SessionResponse } from '@/types/api'
import { request } from './client'

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
