import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { buildUrlWithParam, readUrlParam, useUrlParam } from './useUrlParam'

const views = ['venta', 'ordenes', 'inventario'] as const

describe('readUrlParam', () => {
  it('returns an allowed value or the fallback', () => {
    expect(readUrlParam('?view=ordenes', 'view', views, 'venta')).toBe('ordenes')
    expect(readUrlParam('?view=admin', 'view', views, 'venta')).toBe('venta')
    expect(readUrlParam('', 'view', views, 'venta')).toBe('venta')
  })
})

describe('buildUrlWithParam', () => {
  it('sets the value, drops the fallback and clears child params', () => {
    expect(buildUrlWithParam('http://x/dashboard', 'view', 'inventario', 'venta')).toBe('/dashboard?view=inventario')
    expect(buildUrlWithParam('http://x/dashboard?view=inventario&inv=entradas', 'view', 'venta', 'venta', ['inv'])).toBe('/dashboard')
  })
})

describe('useUrlParam', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('pushes a history entry per change and follows Back', () => {
    window.history.replaceState(null, '', '/dashboard')
    const { result } = renderHook(() => useUrlParam('view', views, 'venta'))
    expect(result.current[0]).toBe('venta')

    act(() => result.current[1]('inventario'))
    expect(result.current[0]).toBe('inventario')
    expect(window.location.search).toBe('?view=inventario')

    act(() => {
      window.history.replaceState(null, '', '/dashboard')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current[0]).toBe('venta')
  })
})
