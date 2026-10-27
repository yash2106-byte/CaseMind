import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DashboardPage } from '@/pages/DashboardPage'
import { server } from '@/mocks/server'
import { customers, metrics } from '@/mocks/fixtures'

const api = '*/api/v1'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  it('formats API decimal rates as percentages and highlights repeated recommendations', async () => {
    renderDashboard()

    expect(await screen.findByText('25%')).toBeInTheDocument()
    expect(screen.getByText('12.5%')).toBeInTheDocument()
    expect(screen.getByText('Previously failed steps recommended again')).toHaveClass('text-cost-foreground')
  })

  it('shows zero counts and rates for an empty dashboard without NaN', async () => {
    server.use(
      http.get(`${api}/customers`, () => HttpResponse.json({ customers: [] })),
      http.get(`${api}/dashboard/metrics`, () => HttpResponse.json({
        totalCases: 0,
        openCases: 0,
        escalatedCases: 0,
        resolvedCases: 0,
        repeatContactRate: 0,
        repeatedRecommendationRate: 0,
      })),
      http.get(`${api}/cases`, () => HttpResponse.json({ cases: [] })),
    )
    renderDashboard()

    expect(await screen.findByText('No cases recorded')).toBeInTheDocument()
    expect(screen.getAllByText('0%')).toHaveLength(2)
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })

  it('shows a retryable API error without substituting fabricated case data', async () => {
    server.use(
      http.get(`${api}/customers`, () => HttpResponse.json({
        error: { code: 'INTERNAL_ERROR', message: 'Unable to load customers.', requestId: 'req-dashboard' },
      }, { status: 500 })),
    )
    renderDashboard()

    expect(await screen.findByText(/req-dashboard/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('Internet connection not working')).not.toBeInTheDocument()
  })

  it('skips overlapping dashboard polls and stops polling after unmount', async () => {
    let metricsRequests = 0
    let releaseBlockedRequest: (() => void) | undefined
    const blocked = new Promise<void>((resolve) => { releaseBlockedRequest = resolve })
    server.use(
      http.get(`${api}/dashboard/metrics`, async () => {
        metricsRequests += 1
        if (metricsRequests === 2) await blocked
        return HttpResponse.json(metrics)
      }),
      http.get(`${api}/customers`, () => HttpResponse.json({ customers })),
    )
    const view = renderDashboard()
    await waitFor(() => expect(metricsRequests).toBe(1))
    await waitFor(() => expect(metricsRequests).toBe(2), { timeout: 3000 })
    await new Promise((resolve) => window.setTimeout(resolve, 2200))
    expect(metricsRequests).toBe(2)

    view.unmount()
    releaseBlockedRequest?.()
    await new Promise((resolve) => window.setTimeout(resolve, 2200))
    expect(metricsRequests).toBe(2)
  }, 10000)
})
