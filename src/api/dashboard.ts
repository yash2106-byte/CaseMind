import type { DashboardMetrics } from '@/types/api'
import { DEMO_MODE } from '@/lib/config'
import { getDemoMetrics, resetDemo } from '@/mocks/mockApi'
import { request } from './client'

export function getDashboardMetrics(signal?: AbortSignal): Promise<DashboardMetrics> {
  if (DEMO_MODE) return getDemoMetrics()
  return request<DashboardMetrics>('/dashboard/metrics', { signal })
}

export function resetDemoState(): Promise<void> {
  if (DEMO_MODE) return resetDemo()
  return Promise.reject(new Error('Demo reset is only available in demo mode.'))
}
