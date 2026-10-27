import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'outline' | 'ghost' | 'solid'
}

export function Button({ children, variant = 'outline', className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-control items-center justify-center rounded-control px-2.5 text-cell font-medium transition-colors',
        variant === 'outline' &&
          'border border-line bg-surface text-ink hover:bg-surface-hover dark:border-line-dark dark:bg-surface-dark dark:text-ink-dark dark:hover:bg-surface-hover-dark',
        variant === 'ghost' &&
          'text-ink-secondary hover:bg-surface-hover hover:text-ink dark:text-ink-secondary-dark dark:hover:bg-surface-hover-dark dark:hover:text-ink-dark',
        variant === 'solid' &&
          'bg-primary-600 text-gray-0 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 dark:text-gray-950',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
