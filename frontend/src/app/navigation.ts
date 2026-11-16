/**
 * Client-side navigation for the hand-written router (app/router.tsx listens to popstate).
 * `replace` is for transitions Back should not return to (entering after the login, leaving
 * after the logout): otherwise Back lands on /login and bounces straight back.
 */
export function navigateTo(path: string, { replace = false }: { replace?: boolean } = {}) {
  if (replace) window.history.replaceState({}, '', path)
  else window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
