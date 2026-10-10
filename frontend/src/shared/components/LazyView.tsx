import { Suspense, type ReactNode } from 'react'
import { ScreenSkeleton } from './ScreenSkeleton'

/** Suspense boundary for views loaded with React.lazy: shows the app spinner while the chunk loads. */
export function LazyView({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <ScreenSkeleton compact />
      }
    >
      {children}
    </Suspense>
  )
}
