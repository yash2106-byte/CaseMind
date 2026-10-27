import type { ReplyKind } from './api'

export interface ChatMessage {
  id: string
  role: 'customer' | 'assistant'
  text: string
  kind?: ReplyKind
  createdAt: string
}
