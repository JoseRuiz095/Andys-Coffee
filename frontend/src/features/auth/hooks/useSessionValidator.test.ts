import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { AuthUser } from '../types/auth.types'

const getCurrentUser = vi.fn<() => Promise<AuthUser>>()
vi.mock('../services/auth.service', () => ({ getCurrentUser: () => getCurrentUser() }))

const { useSessionValidator } = await import('./useSessionValidator')
const { authStore } = await import('../store/auth.store')
const { PERMISSIONS_STALE_EVENT } = await import('../../../app/api')

const user = { id: 'u1', name: 'Ana', email: 'ana@example.com', permissions: ['sales.create'] } as unknown as AuthUser

describe('useSessionValidator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getCurrentUser.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    act(() => authStore.clearSession())
  })

  it('does not poll on the login screen', async () => {
    renderHook(() => useSessionValidator())
    await act(() => vi.advanceTimersByTimeAsync(31 * 60 * 1000))
    expect(getCurrentUser).not.toHaveBeenCalled()
  })

  it('refreshes the user (and its permissions) while logged in', async () => {
    act(() => authStore.setSession(user))
    const refreshed = { ...user, permissions: ['sales.create', 'cash.close'] } as AuthUser
    getCurrentUser.mockResolvedValue(refreshed)
    renderHook(() => useSessionValidator())
    await act(() => vi.advanceTimersByTimeAsync(30 * 60 * 1000))
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
    expect(authStore.getState().user?.permissions).toEqual(['sales.create', 'cash.close'])
  })

  it('re-reads the permissions right after a 403, at most once a minute', async () => {
    act(() => authStore.setSession(user))
    const reduced = { ...user, permissions: [] } as unknown as AuthUser
    getCurrentUser.mockResolvedValue(reduced)
    renderHook(() => useSessionValidator())
    await act(async () => {
      window.dispatchEvent(new Event(PERMISSIONS_STALE_EVENT))
      window.dispatchEvent(new Event(PERMISSIONS_STALE_EVENT))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(getCurrentUser).toHaveBeenCalledTimes(1)
    expect(authStore.getState().user?.permissions).toEqual([])
  })
})
