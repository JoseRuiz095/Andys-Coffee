import type { HTMLAttributes } from 'react'

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  className?: string
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-slate-200 ${className}`}
      {...props}
    />
  )
}
