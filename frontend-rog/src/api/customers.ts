import type { Customer } from '@/types/api'
import { DEMO_MODE } from '@/lib/config'
import { getDemoCustomers } from '@/mocks/mockApi'
import { request } from './client'

export async function getCustomers(signal?: AbortSignal): Promise<Customer[]> {
  if (DEMO_MODE) return getDemoCustomers()
  const response = await request<{ customers: Customer[] }>('/customers', { signal })
  return response.customers
}
