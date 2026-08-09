import type { ReactNode } from 'react'
import { useTheme } from '../assets/theme'
import LogoAndysVector from '../assets/logo/LogoAndysVector.svg'
import { Card } from '../components/Card'

type AuthLayoutProps = {
  children: ReactNode
  subtitle: string
  title: string
}

type CoffeeIllustrationProps = {
  backgroundColor: string
}

function CoffeeIllustration({ backgroundColor }: CoffeeIllustrationProps) {
  return (
    <div
      role="img"
      aria-label="Andys Coffee logo"
      className="h-90 w-full max-w-full"
      style={{
        mask: `url(${LogoAndysVector}) no-repeat center / contain`,
        WebkitMask: `url(${LogoAndysVector}) no-repeat center / contain`,
        backgroundColor,
      }}
    />
  )
}

export function AuthLayout({ children, subtitle, title }: AuthLayoutProps) {
  const { colors, mode, toggleTheme } = useTheme()

  return (
    <main className="h-dvh min-w-[1024px] overflow-hidden p-4 lg:p-6" style={{ backgroundColor: colors.background }}>
      <div className="mx-auto flex h-full w-full max-w-screen-xl items-center justify-center overflow-y-auto">
        <Card
          aria-label="Coffee login"
          className="relative grid min-h-[min(41rem,calc(100dvh-2rem))] w-full max-w-7xl grid-cols-[minmax(0,1.03fr)_minmax(0,0.97fr)] overflow-hidden rounded-3xl shadow-[1.125rem_1.25rem_1.125rem_rgba(0,0,0,0.25)]"
          style={{ backgroundColor: colors.surface }}
        >
          <div
            className="relative z-10 flex min-w-0 flex-col justify-between gap-6 overflow-hidden px-10 py-10 text-white lg:px-14 lg:py-12"
            style={{ backgroundColor: colors.panelLeftBg }}
          >
            <div className="flex items-center justify-start">
              <CoffeeIllustration backgroundColor={colors.surfaceSecondary} />
            </div>

            <div className="max-w-sm">
              <h2 className="text-5xl font-bold tracking-tight text-white">{title}</h2>
              <p className="mt-4 text-sm font-medium leading-relaxed text-[#D9E3D6]">
                {subtitle}
              </p>
            </div>

            <div className="grid gap-3">
              <p className="text-sm text-[#E7E5DB]">
                Descubre un diseño calmado y funcional para tu gestión diaria.
              </p>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex w-fit items-center justify-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                {mode === 'light' ? 'Modo oscuro' : 'Modo claro'}
              </button>
            </div>
          </div>

          <div className="relative z-10 flex min-w-0 items-center justify-center overflow-hidden" style={{ backgroundColor: colors.panelRightBg }}>
            <div className="relative z-10 flex w-full items-center justify-center">
              {children}
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}
