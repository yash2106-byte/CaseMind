import type { ApiErrorEnvelope } from '@/types/api'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/+$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | null

  constructor(message: string, status: number, code: string, requestId: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(
      `Could not connect to the CaseMind API at ${API_BASE_URL}. Start the backend service and try again.`,
      0,
      'NETWORK_ERROR',
    )
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const payload = body as ApiErrorEnvelope | null
    throw new ApiError(
      payload?.error?.message ?? `The request failed with status ${response.status}.`,
      response.status,
      payload?.error?.code ?? 'HTTP_ERROR',
      payload?.error?.requestId ?? null,
    )
  }

  if (body === null) {
    throw new ApiError('The API returned an empty or invalid JSON response.', response.status, 'INVALID_RESPONSE')
  }
  return body as T
}
