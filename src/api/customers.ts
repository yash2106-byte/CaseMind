import type { Customer } from '@/types/api'
import { request } from './client'

export async function getCustomers(signal?: AbortSignal): Promise<Customer[]> {
  const response = await request<{ customers: Customer[] }>('/customers', { signal })
  return response.customers
}
