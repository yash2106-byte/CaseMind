import type { DashboardMetrics } from '@/types/api'
import { request } from './client'

export function getDashboardMetrics(signal?: AbortSignal): Promise<DashboardMetrics> {
  return request<DashboardMetrics>('/dashboard/metrics', { signal })
}
