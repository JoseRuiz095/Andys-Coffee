import { useCallback, useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  return () => window.removeEventListener('popstate', onChange)
}

const getSearch = () => window.location.search

export interface SetUrlParamOptions {
  /** Child params that belong to the previous value (e.g. the inventory tab when leaving it). */
  clear?: string[]
}

/** Reads `name` from the query string; values outside `allowed` (or not permitted) fall back. */
export function readUrlParam<T extends string>(search: string, name: string, allowed: readonly T[], fallback: T): T {
  const value = new URLSearchParams(search).get(name)
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

/** URL with `name` set to `value` (removed when it equals the fallback) and `clear` removed. */
export function buildUrlWithParam(href: string, name: string, value: string, fallback: string, clear: string[] = []): string {
  const url = new URL(href)
  if (value === fallback) url.searchParams.delete(name)
  else url.searchParams.set(name, value)
  for (const param of clear) url.searchParams.delete(param)
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Tab/view state kept in the URL (`?view=inventario&inv=entradas`), so a reload keeps the
 * screen and the browser's Back button returns to the previous tab. `allowed` should already be
 * filtered by the user's permissions: a link to a tab they can't open shows `fallback`.
 */
export function useUrlParam<T extends string>(
  name: string,
  allowed: readonly T[],
  fallback: T,
): [T, (value: T, options?: SetUrlParamOptions) => void] {
  const search = useSyncExternalStore(subscribe, getSearch, getSearch)
  const value = readUrlParam(search, name, allowed, fallback)

  const setValue = useCallback(
    (next: T, options?: SetUrlParamOptions) => {
      const nextUrl = buildUrlWithParam(window.location.href, name, next, fallback, options?.clear)
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextUrl === currentUrl) return
      window.history.pushState(window.history.state, '', nextUrl)
      // pushState fires no event: tell every subscriber (and the router) the URL changed.
      window.dispatchEvent(new PopStateEvent('popstate'))
    },
    [name, fallback],
  )

  return [value, setValue]
}
