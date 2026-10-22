import type { FormEvent } from 'react'
import type { ChatMessage } from '@/types/chat'
import type { CaseStatus } from '@/types/api'
import { MessageComposer } from '@/components/MessageComposer'
import { MessageList } from '@/components/MessageList'

interface ChatPanelProps {
  sessionId: string | null
  messages: ChatMessage[]
  draft: string
  pending: boolean
  hasExistingCase: boolean
  caseStatus: CaseStatus | null
  onDraftChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function ChatPanel({
  sessionId,
  messages,
  draft,
  pending,
  hasExistingCase,
  caseStatus,
  onDraftChange,
  onSubmit,
}: ChatPanelProps) {
  const closedStatus = caseStatus === 'escalated' || caseStatus === 'resolved' || caseStatus === 'closed'
    ? caseStatus
    : null

  return (
    <div className="flex min-h-96 flex-col">
      <div className="flex items-center justify-between border-b border-line-divider px-4 py-3 dark:border-line-divider-dark sm:px-5">
        <h2 className="text-card font-semibold text-ink dark:text-ink-dark">Conversation</h2>
        {sessionId ? <span className="text-caption text-ink-muted dark:text-ink-muted-dark">Session active</span> : null}
      </div>
      {!sessionId ? (
        <div className="flex flex-1 flex-col justify-center p-4 sm:p-5">
          <p className="text-body font-semibold text-ink dark:text-ink-dark">
            {hasExistingCase ? 'Continue the support conversation' : 'Start a support conversation'}
          </p>
          <p className="mt-2 text-cell text-ink-secondary dark:text-ink-secondary-dark">
            {hasExistingCase
              ? 'Starting a new chat will let the backend resume this case and apply its contact-count rules.'
              : 'Choose one of the seeded demo customers, then start a chat to create a backend session.'}
          </p>
        </div>
      ) : (
        <>
          <MessageList messages={messages} waiting={pending} />
          <MessageComposer
            draft={draft}
            disabled={pending}
            sending={pending}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
            caseStatus={closedStatus}
          />
        </>
      )}
    </div>
  )
}
