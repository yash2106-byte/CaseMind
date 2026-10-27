import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ThemeSwitchProps {
  isDark: boolean
  onToggle: () => void
  className?: string
}

export function ThemeSwitch({ isDark, onToggle, className }: ThemeSwitchProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-control border border-line bg-surface text-ink-secondary transition-colors',
        'hover:bg-surface-hover hover:text-ink',
        'dark:border-line-dark dark:bg-surface-dark dark:text-ink-secondary-dark dark:hover:bg-surface-hover-dark dark:hover:text-ink-dark',
        className,
      )}
    >
      {isDark ? <Sun className="size-3.5" strokeWidth={1.75} /> : <Moon className="size-3.5" strokeWidth={1.75} />}
    </button>
  )
}
