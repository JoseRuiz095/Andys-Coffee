import type { HTMLAttributes } from 'react'

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  className?: string
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md ${className}`}
      style={{ backgroundColor: 'var(--color-border)' }}
      {...props}
    />
  )
}
