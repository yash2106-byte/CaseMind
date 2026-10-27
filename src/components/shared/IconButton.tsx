import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
  size?: 'sm' | 'md'
}

export function IconButton({ label, children, size = 'md', className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-sm text-ink-secondary transition-colors',
        'hover:bg-surface-hover hover:text-ink',
        'dark:text-ink-secondary-dark dark:hover:bg-surface-hover-dark dark:hover:text-ink-dark',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'size-5' : 'size-6',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
