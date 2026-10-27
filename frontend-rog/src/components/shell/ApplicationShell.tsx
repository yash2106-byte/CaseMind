import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Menu, MessageCircle, X } from 'lucide-react'
import { ThemeSwitch } from '@/components/ThemeSwitch'
import { IconButton } from '@/components/shared/IconButton'
import { DEMO_MODE } from '@/lib/config'
import { cn } from '@/lib/cn'

interface ApplicationShellProps {
  isDark: boolean
  onToggleTheme: () => void
}

const navigation = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Support', to: '/support', icon: MessageCircle },
]

function BrandMark() {
  return (
    <span className="inline-flex size-brand shrink-0 items-center justify-center rounded-control bg-ink text-gray-0 dark:bg-gray-0 dark:text-ink">
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
        <path d="M3 12 7 3l2 4 3-4v8H3Z" fill="currentColor" />
      </svg>
    </span>
  )
}

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  return navigation.map(({ label, to, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-10 items-center gap-2 px-3 text-body transition-colors',
          isActive
            ? 'font-semibold text-ink dark:text-ink-dark'
            : 'text-ink-secondary hover:text-ink dark:text-ink-secondary-dark dark:hover:text-ink-dark',
        )
      }
      end
    >
      {({ isActive }) => (
        <>
          <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {label}
          {isActive ? <span className="absolute inset-x-3 bottom-0 h-0.5 bg-primary-600 dark:bg-primary-400" /> : null}
        </>
      )}
    </NavLink>
  ))
}

export function ApplicationShell({ isDark, onToggleTheme }: ApplicationShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const pageLabel = location.pathname.startsWith('/cases/') ? 'Case detail' : location.pathname === '/support' ? 'Customer support' : 'Case overview'

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-canvas py-0 dark:bg-canvas-dark md:py-4 xl:py-6 2xl:py-8">
      <div className="relative mx-auto min-h-screen w-full overflow-hidden bg-surface dark:bg-surface-dark md:min-h-[calc(100vh-2rem)] md:w-[calc(100%-2rem)] md:rounded-lg md:shadow-shell dark:md:shadow-shell-dark xl:w-[calc(100%-3rem)] xl:max-w-shell xl:rounded-shell 2xl:w-[calc(100%-4rem)]">
        <header className="relative z-20 flex h-12 items-center justify-between gap-3 border-b border-line-divider bg-header px-3 dark:border-line-divider-dark dark:bg-header-dark md:h-header md:px-4">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-sm" aria-label="CaseMind overview">
            <BrandMark />
            <span className="truncate text-brand font-bold tracking-tight text-ink dark:text-ink-dark">CaseMind</span>
          </Link>

          <nav className="hidden h-full items-center md:flex" aria-label="Primary navigation">
            <NavigationLinks />
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {DEMO_MODE ? (
              <span className="rounded-control border border-primary-200 bg-primary-50 px-2 py-1 text-caption font-semibold tracking-wide text-primary-800 dark:border-primary-800 dark:bg-primary-950 dark:text-primary-200">
                DEMO MODE
              </span>
            ) : null}
            <ThemeSwitch isDark={isDark} onToggle={onToggleTheme} />
            <div className="md:hidden">
              <IconButton
                label={mobileOpen ? 'Close navigation' : 'Open navigation'}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((current) => !current)}
              >
                {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </IconButton>
            </div>
          </div>

          {mobileOpen ? (
            <nav
              className="absolute inset-x-0 top-full z-30 border-b border-line bg-surface p-2 shadow-popover dark:border-line-dark dark:bg-surface-dark dark:shadow-popover-dark md:hidden"
              aria-label="Mobile navigation"
            >
              <NavigationLinks onNavigate={() => setMobileOpen(false)} />
            </nav>
          ) : null}
        </header>

        <div className="flex min-h-context items-center justify-between gap-3 border-b border-line-divider bg-header-sub px-3 dark:border-line-divider-dark dark:bg-header-sub-dark md:px-4">
          <div className="min-w-0">
            <p className="truncate text-cell font-medium text-ink dark:text-ink-dark">{pageLabel}</p>
            <p className="hidden truncate text-caption text-ink-secondary dark:text-ink-secondary-dark sm:block">
              Internet connectivity support · Phase 1
            </p>
          </div>
          <Link
            to="/support"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1 text-cell font-medium text-ink transition-colors hover:bg-surface-hover dark:border-line-dark dark:bg-surface-dark dark:text-ink-dark dark:hover:bg-surface-hover-dark"
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Start support chat</span>
            <span className="sm:hidden">Support chat</span>
          </Link>
        </div>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
