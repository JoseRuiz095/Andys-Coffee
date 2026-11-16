import { Suspense, type ReactNode } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import { ScreenSkeleton } from './ScreenSkeleton'

/**
 * Boundary for views loaded with React.lazy: the app spinner while the chunk loads, and an error
 * fallback limited to the view (a failed view no longer takes the whole app down).
 */
export function LazyView({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<ScreenSkeleton compact />}>{children}</Suspense>
    </ErrorBoundary>
  )
}
