import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createDemoSession,
  getDemoCase,
  getDemoCases,
  getDemoCustomers,
  getDemoHandoff,
  getDemoMetrics,
  openDemoWorkspace,
  recordDemoOutcome,
  resetDemoState,
  sendDemoMessage,
} from '@/mocks/mockApi'

const AARAV_ID = '11111111-1111-4111-8111-111111111111'
const PRIYA_ID = '22222222-2222-4222-8222-222222222222'
const ROHAN_ID = '33333333-3333-4333-8333-333333333333'
const AARAV_CASE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PRIYA_CASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ROHAN_CASE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

beforeEach(() => resetDemoState())

describe('seeded demo service', () => {
  it('loads the three deterministic customers and the specified initial case scenarios', async () => {
    const customers = await getDemoCustomers()
    const [aarav, priya, rohan] = await Promise.all([
      getDemoCase(AARAV_CASE),
      getDemoCase(PRIYA_CASE),
      getDemoCase(ROHAN_CASE),
    ])

    expect(customers.map(({ id, displayName }) => [id, displayName])).toEqual([
      [AARAV_ID, 'Aarav Sharma'],
      [PRIYA_ID, 'Priya Das'],
      [ROHAN_ID, 'Rohan Mehta'],
    ])
    expect(aarav).toMatchObject({ status: 'in_progress', contactCount: 1, currentStepKey: 'router_power_cycle' })
    expect(priya).toMatchObject({ status: 'in_progress', contactCount: 2, currentStepKey: 'check_cables_lights' })
    expect(priya.actions[0]).toMatchObject({ stepKey: 'router_power_cycle', status: 'failed', customerNote: 'The internet disconnected again.' })
    expect(rohan).toMatchObject({ status: 'escalated', contactCount: 3, currentStepKey: null })
    expect(rohan.handoffSummary).toContain('contact_limit_reached')
  })

  it('records failed outcomes and recommends the next eligible step without removing history', async () => {
    const workspace = await openDemoWorkspace(AARAV_ID)
    const currentAction = workspace.caseDetail!.actions[0]
    const result = await recordDemoOutcome(AARAV_CASE, currentAction.id, 'failed', 'Still offline after reboot.')

    expect(result.case.actions).toHaveLength(2)
    expect(result.case.actions[0]).toMatchObject({ status: 'failed', customerNote: 'Still offline after reboot.' })
    expect(result.case.actions[1]).toMatchObject({ stepKey: 'check_cables_lights', status: 'recommended' })
    expect(result.case.events.slice(-2).map(({ type }) => type)).toEqual(['action_outcome_recorded', 'action_recommended'])
    expect(result.recommendedAction?.stepKey).toBe('check_cables_lights')
  })

  it('resolves the case after success and updates metrics from the current state', async () => {
    const workspace = await openDemoWorkspace(AARAV_ID)
    const result = await recordDemoOutcome(AARAV_CASE, workspace.caseDetail!.actions[0].id, 'succeeded')
    const metrics = await getDemoMetrics()

    expect(result.case).toMatchObject({ status: 'resolved', currentStepKey: null })
    expect(result.case.resolvedAt).toEqual(expect.any(String))
    expect(result.recommendedAction).toBeNull()
    expect(metrics).toMatchObject({ totalCases: 3, openCases: 1, escalatedCases: 1, resolvedCases: 1 })
  })

  it('keeps an unknown outcome on the same step until a later clarified outcome', async () => {
    const workspace = await openDemoWorkspace(AARAV_ID)
    const actionId = workspace.caseDetail!.actions[0].id
    const unknown = await recordDemoOutcome(AARAV_CASE, actionId, 'unknown')

    expect(unknown.case.currentStepKey).toBe('router_power_cycle')
    expect(unknown.recommendedAction?.id).toBe(actionId)
    expect(unknown.case.actions).toHaveLength(1)
    const clarified = await recordDemoOutcome(AARAV_CASE, actionId, 'failed', 'Retested; it is still offline.')
    expect(clarified.case.actions.map(({ status }) => status)).toEqual(['failed', 'recommended'])
    expect(clarified.case.currentStepKey).toBe('check_cables_lights')
  })

  it('increments returning contacts exactly once and escalates at the third contact', async () => {
    const created = await createDemoSession(PRIYA_ID)
    const current = await getDemoCase(PRIYA_CASE)

    expect(created.case?.contactCount).toBe(3)
    expect(created.escalationRequired).toBe(true)
    expect(current.contactCount).toBe(3)
    expect(current.status).toBe('escalated')
    expect(current.currentStepKey).toBeNull()
    expect((await getDemoHandoff(PRIYA_CASE)).failedActions).toEqual(['router_power_cycle'])
  })

  it('does not attach a new session to an escalated case', async () => {
    const response = await createDemoSession(ROHAN_ID)
    expect(response).toMatchObject({ case: null, escalationRequired: false, handoffSummary: null })
    expect((await getDemoCase(ROHAN_CASE)).status).toBe('escalated')
  })

  it('returns a scope reply without creating an unrelated case', async () => {
    const session = await createDemoSession(ROHAN_ID)
    const before = (await getDemoCases(ROHAN_ID, ['open', 'in_progress', 'escalated', 'resolved', 'closed'])).length
    const result = await sendDemoMessage(session.sessionId, 'Can you help me with my tax return?')
    const after = (await getDemoCases(ROHAN_ID, ['open', 'in_progress', 'escalated', 'resolved', 'closed'])).length

    expect(result.case).toBeNull()
    expect(result.reply.kind).toBe('scope')
    expect(after).toBe(before)
  })

  it('restores all seed data and initial metrics on reset', async () => {
    const workspace = await openDemoWorkspace(AARAV_ID)
    await recordDemoOutcome(AARAV_CASE, workspace.caseDetail!.actions[0].id, 'succeeded')
    expect((await getDemoMetrics()).resolvedCases).toBe(1)

    resetDemoState()
    expect((await getDemoMetrics()).resolvedCases).toBe(0)
    expect((await getDemoCase(AARAV_CASE)).contactCount).toBe(1)
    expect((await getDemoCase(AARAV_CASE)).actions).toHaveLength(1)
  })

  it('routes customer requests to mock fixtures when demo mode is explicitly enabled', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    vi.resetModules()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      const { getCustomers } = await import('@/api/customers')
      const { getDashboardMetrics, resetDemoState: resetThroughApi } = await import('@/api/dashboard')
      const {
        getCase: getCaseThroughApi,
        getCaseTimeline,
        getHandoffSummary,
        getCases,
        recordActionOutcome: submitOutcome,
      } = await import('@/api/cases')
      const { createSession: startSession, sendMessage: sendDemoMessage } = await import('@/api/sessions')
      const customers = await getCustomers()
      expect(customers).toHaveLength(3)
      expect((await getDashboardMetrics()).totalCases).toBe(3)
      expect((await getCases(AARAV_ID, ['open', 'in_progress', 'escalated'])).map(({ id }) => id)).toEqual([AARAV_CASE])
      const detail = await getCaseThroughApi(AARAV_CASE)
      expect((await getCaseTimeline(AARAV_CASE)).length).toBeGreaterThan(0)
      expect((await getHandoffSummary(ROHAN_CASE)).contactCount).toBe(3)
      const session = await startSession(AARAV_ID)
      await sendDemoMessage(session.sessionId, 'The internet still does not work.')
      await submitOutcome(AARAV_CASE, detail.actions[0].id, 'failed')
      expect(fetchSpy).not.toHaveBeenCalled()
      await resetThroughApi()
    } finally {
      fetchSpy.mockRestore()
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })
})
