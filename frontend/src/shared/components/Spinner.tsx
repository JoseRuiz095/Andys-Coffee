import { bouncy } from 'ldrs'
import { useTheme } from '../assets/theme'

bouncy.register()

type SpinnerProps = {
  size?: number | string
  speed?: number | string
  color?: string
}

export function Spinner({ size = 45, speed = 1.75, color }: SpinnerProps) {
  const { colors } = useTheme()
  const resolvedColor = color ?? colors.text
  return <l-bouncy size={String(size)} speed={String(speed)} color={resolvedColor} />
}
