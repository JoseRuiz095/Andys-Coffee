import { Suspense, type ReactNode } from 'react'
import { Spinner } from './Spinner'

/** Suspense boundary for views loaded with React.lazy: shows the app spinner while the chunk loads. */
export function LazyView({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}
