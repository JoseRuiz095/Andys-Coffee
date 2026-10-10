import { Skeleton } from './Skeleton'

type ScreenSkeletonProps = {
  compact?: boolean
}

export function ScreenSkeleton({ compact = false }: ScreenSkeletonProps) {
  return (
    <div
      className={`min-h-[40vh] space-y-6 p-4 sm:p-6 ${compact ? 'mx-auto max-w-7xl' : ''}`}
      aria-busy="true"
      aria-label="Cargando pantalla"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-[60vw]" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24 rounded-lg" />
        ))}
      </div>

      <div className="space-y-3 rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
        <Skeleton className="h-5 w-40" />
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
