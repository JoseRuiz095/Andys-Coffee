import type { CSSProperties } from 'react'
import LogoAndysVectorAsset from './LogoAndysVector.svg'

type LogoAndysVectorProps = {
  color?: string
  className?: string
  style?: CSSProperties
}

export function LogoAndysVector({ color = 'currentColor', className = '', style, ...props }: LogoAndysVectorProps) {
  return (
    <div
      role="img"
      aria-label="Andys Coffee logo"
      className={className}
      style={{
        backgroundColor: color,
        mask: `url(${LogoAndysVectorAsset}) no-repeat center / contain`,
        WebkitMask: `url(${LogoAndysVectorAsset}) no-repeat center / contain`,
        ...style,
      }}
      {...props}
    />
  )
}
