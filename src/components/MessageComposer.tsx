import type { FormEvent, KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/shared/Button'
import { LoadingIndicator } from '@/components/shared/LoadingIndicator'

interface MessageComposerProps {
  draft: string
  disabled: boolean
  sending: boolean
  onDraftChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  caseStatus: 'escalated' | 'resolved' | 'closed' | null
}

export function MessageComposer({
  draft,
  disabled,
  sending,
  onDraftChange,
  onSubmit,
  caseStatus,
}: MessageComposerProps) {
  const caseClosed = caseStatus !== null

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <form onSubmit={onSubmit} className="border-t border-line-divider p-4 dark:border-line-divider-dark sm:p-5">
      {caseClosed ? (
        <div className="mb-3 rounded-control border border-secondary-200 bg-secondary-50 px-3 py-2 text-cell text-secondary-800 dark:border-secondary-800 dark:bg-secondary-950 dark:text-secondary-200">
          {caseStatus === 'escalated'
            ? 'Automated troubleshooting has stopped for this escalated case.'
            : caseStatus === 'resolved'
              ? 'This case is resolved. Start a new chat if there is a different issue.'
              : 'This case is closed. Start a new chat to report a new issue.'}
        </div>
      ) : null}
      <label className="sr-only" htmlFor="support-message">Message</label>
      <div className="flex items-end gap-2">
        <textarea
          id="support-message"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={caseClosed ? 'Start a new chat to continue' : 'Describe the internet connection issue…'}
          rows={2}
          maxLength={2000}
          disabled={caseClosed || disabled}
          className="min-h-12 flex-1 resize-y rounded-control border border-input-border bg-input px-3 py-2 text-body text-ink placeholder:text-ink-muted disabled:opacity-60 dark:border-input-border-dark dark:bg-input-dark dark:text-ink-dark"
        />
        <Button type="submit" variant="solid" disabled={!draft.trim() || caseClosed || disabled} aria-label="Send message">
          {sending ? <LoadingIndicator label="Sending" /> : <Send className="size-4" aria-hidden="true" />}
        </Button>
      </div>
      <p className="mt-1.5 text-right text-caption text-ink-muted dark:text-ink-muted-dark">Enter to send · Shift+Enter for a new line</p>
    </form>
  )
}
