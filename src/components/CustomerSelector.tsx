import type { Customer } from '@/types/api'
import { Button } from '@/components/shared/Button'

interface CustomerSelectorProps {
  customers: Customer[]
  selectedCustomerId: string
  onSelect: (customerId: string) => void
  onStartChat: () => void
  disabled: boolean
  starting: boolean
  prominent: boolean
  continueCase: boolean
}

export function CustomerSelector({
  customers,
  selectedCustomerId,
  onSelect,
  onStartChat,
  disabled,
  starting,
  prominent,
  continueCase,
}: CustomerSelectorProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <label className="grid min-w-48 flex-1 gap-1.5 text-caption font-medium uppercase text-ink-muted dark:text-ink-muted-dark">
        Demo customer
        <select
          value={selectedCustomerId}
          onChange={(event) => onSelect(event.target.value)}
          disabled={disabled}
          className="h-9 rounded-control border border-input-border bg-input px-2 text-body font-normal text-ink disabled:opacity-70 dark:border-input-border-dark dark:bg-input-dark dark:text-ink-dark"
        >
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.displayName}</option>
          ))}
          {!customers.length ? <option value="">No seeded customers</option> : null}
        </select>
      </label>
      <Button variant={prominent ? 'solid' : 'outline'} onClick={onStartChat} disabled={!selectedCustomerId || disabled}>
        {starting ? 'Starting…' : continueCase ? 'Continue this case' : 'Start new chat'}
      </Button>
    </div>
  )
}
