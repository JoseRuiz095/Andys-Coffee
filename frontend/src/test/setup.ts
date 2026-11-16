import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// A few tests run in the node environment (e.g. reading files): skip the DOM setup there.
const hasDom = typeof window !== 'undefined'

if (hasDom) {
  // jsdom has no layout: the body scroll lock restores the scroll position with scrollTo.
  window.scrollTo = () => {}
}

// Testing Library only auto-cleans when the runner exposes globals; Vitest is used without them.
afterEach(() => {
  if (!hasDom) return
  cleanup()
  window.sessionStorage.clear()
  window.localStorage.clear()
})
