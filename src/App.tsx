import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ApplicationShell } from '@/components/shell/ApplicationShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { SupportPage } from '@/pages/SupportPage'

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('casemind-theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('casemind-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        element={
          <ApplicationShell
            isDark={isDark}
            onToggleTheme={() => setIsDark((current) => !current)}
          />
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/cases/:caseId" element={<SupportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
