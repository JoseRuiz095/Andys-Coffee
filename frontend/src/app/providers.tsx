import type { ReactNode } from 'react'
import { ThemeProvider } from '../shared/assets/theme'

type ProvidersProps = {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return <ThemeProvider>{children}</ThemeProvider>
}
