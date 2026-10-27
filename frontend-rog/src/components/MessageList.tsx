import { MessageSquareText } from 'lucide-react'
import type { ChatMessage } from '@/types/chat'
import { LoadingIndicator } from '@/components/shared/LoadingIndicator'
import { DEMO_MODE } from '@/lib/config'
import { cn } from '@/lib/cn'

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

interface MessageListProps {
  messages: ChatMessage[]
  waiting: boolean
}

export function MessageList({ messages, waiting }: MessageListProps) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite" aria-label="Conversation messages">
      {messages.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center text-center">
          <MessageSquareText className="size-5 text-ink-muted dark:text-ink-muted-dark" aria-hidden="true" />
          <p className="mt-3 text-body font-medium text-ink dark:text-ink-dark">How can we help with your connection?</p>
          <p className="mt-1 max-w-sm text-cell text-ink-secondary dark:text-ink-secondary-dark">
            {DEMO_MODE
              ? 'This demo uses deterministic simulated support responses. Describe what is happening with your internet connection.'
              : 'Describe what is happening. Case classification and troubleshooting are handled by the backend.'}
          </p>
        </div>
      ) : null}
      {messages.map((message) => (
        <article key={message.id} className={cn('flex', message.role === 'customer' ? 'justify-end' : 'justify-start')}>
          <div className={cn(
            'max-w-[92%] rounded-md border px-3 py-2.5 sm:max-w-[85%]',
            message.role === 'customer'
              ? 'border-primary-200 bg-primary-50 text-ink dark:border-primary-900 dark:bg-primary-950 dark:text-ink-dark'
              : 'border-line bg-surface-subtle text-ink dark:border-line-dark dark:bg-surface-subtle-dark dark:text-ink-dark',
          )}>
            <p className="whitespace-pre-wrap break-words text-body">{message.text}</p>
            <p className="mt-2 text-right text-caption text-ink-muted dark:text-ink-muted-dark">{formatDate(message.createdAt)}</p>
          </div>
        </article>
      ))}
      {waiting ? <LoadingIndicator label="Waiting for the support response" /> : null}
    </div>
  )
}
