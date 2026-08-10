import { bouncy } from 'ldrs'

bouncy.register()

type SpinnerProps = {
  size?: number | string
  speed?: number | string
  color?: string
}

export function Spinner({ size = 45, speed = 1.75, color = 'black' }: SpinnerProps) {
  return <l-bouncy size={String(size)} speed={String(speed)} color={color} />
}
