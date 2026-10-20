import { useEffect, useState } from 'react'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/**
 * useState that survives a reload of the same browser tab (sessionStorage). Storage can be
 * unavailable or full (private mode, quotas): it then behaves like plain useState.
 * When `key` changes (e.g. another user signs in), the value for the new key is loaded.
 */
export function useSessionState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<{ key: string; value: T }>(() => ({ key, value: read(key, initialValue) }))
  const value = state.key === key ? state.value : read(key, initialValue)
  if (state.key !== key) setState({ key, value })

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Not persisted: the state still works for this page view.
    }
  }, [key, value])

  const setValue = (next: T | ((previous: T) => T)) =>
    setState((current) => {
      const previous = current.key === key ? current.value : read(key, initialValue)
      return { key, value: typeof next === 'function' ? (next as (previous: T) => T)(previous) : next }
    })

  return [value, setValue] as const
}

/** Reads/writes one sessionStorage entry outside React state (e.g. a ref-like value). */
export const sessionEntry = {
  get(key: string): string | null {
    try {
      return window.sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) window.sessionStorage.removeItem(key)
      else window.sessionStorage.setItem(key, value)
    } catch {
      // Ignored: see useSessionState.
    }
  },
}
