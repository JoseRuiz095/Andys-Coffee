import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOAD_MARK_KEY = 'andy-chunk-reload-at'
/** A second failure within this window is a real error, not a stale deploy: don't loop. */
const RELOAD_GUARD_MS = 30_000

/** Browser messages for a dynamic import whose file is gone (Chrome/Edge, Firefox, Safari). */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)
}

function readReloadMark(): number | null {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_MARK_KEY)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

function writeReloadMark(value: number | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(RELOAD_MARK_KEY)
    else window.sessionStorage.setItem(RELOAD_MARK_KEY, String(value))
  } catch {
    // Without storage the guard can't be kept: the error boundary shows "Recargar" instead.
  }
}

/** Whether a failed chunk should trigger one automatic reload (and records it). */
export function shouldReloadForChunkError(error: unknown, now = Date.now()): boolean {
  if (!isChunkLoadError(error)) return false
  const lastReload = readReloadMark()
  if (lastReload !== null && now - lastReload < RELOAD_GUARD_MS) return false
  writeReloadMark(now)
  // Only reload when the mark was stored: without it a reload could loop forever.
  return readReloadMark() === now
}

/**
 * React.lazy that survives a deploy: the open tab still references the previous build's chunk
 * names, which no longer exist, so the import fails. Reloading once loads the new build.
 */
// For the app's lazily loaded pages, which take no props.
export function lazyWithReload(
  factory: () => Promise<{ default: ComponentType }>,
): LazyExoticComponent<ComponentType> {
  return lazy(async (): Promise<{ default: ComponentType }> => {
    try {
      return await factory()
    } catch (error) {
      if (shouldReloadForChunkError(error)) {
        window.location.reload()
        // Keep suspended until the page goes away.
        return new Promise<never>(() => {})
      }
      throw error
    }
  })
}
