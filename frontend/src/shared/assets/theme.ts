import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'

type ThemePalette = {
  background: string
  surface: string
  surfaceSecondary: string
  panelLeftBg: string
  panelRightBg: string
  primary: string
  primaryHover: string
  accent: string
  text: string
  textMuted: string
  textLight: string
  buttonText: string
  border: string
  inputBg: string
  inputText: string
  placeholder: string
  ghostText: string
}

type ThemeContextValue = {
  mode: ThemeMode
  colors: ThemePalette
  toggleTheme: () => void
}

export const themePalettes: Record<ThemeMode, ThemePalette> = {
  light: {
    background: '#2C211D',
    surface: '#FDFBF7',
    surfaceSecondary: '#D9E3D6',
    panelLeftBg: '#5A804F',
    panelRightBg: '#FDFBF7',
    primary: '#5A804F',
    primaryHover: '#486B3E',
    accent: '#5A804F',
    text: '#1F2937',
    textMuted: '#6B7280',
    textLight: '#FFFFFF',
    buttonText: '#FFFFFF',
    border: '#E7E3DC',
    inputBg: '#F2EFE8',
    inputText: '#1F2937',
    placeholder: '#9CA3AF',
    ghostText: '#4B5563',
  },
  dark: {
    background: '#0F1110',
    surface: '#212724',
    surfaceSecondary: '#CDA870',
    panelLeftBg: '#1A1F1D',
    panelRightBg: '#212724',
    primary: '#CDA870',
    primaryHover: '#E5C189',
    accent: '#CDA870',
    text: '#E5E7EB',
    textMuted: '#9CA3AF',
    textLight: '#1A1D1A',
    buttonText: '#1A1D1A',
    border: '#374040',
    inputBg: '#141816',
    inputText: '#E5E7EB',
    placeholder: '#6B7280',
    ghostText: '#D1D5DB',
  },
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: themePalettes.light,
  toggleTheme: () => {},
})

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return 'light'
    }

    return (window.localStorage.getItem('andy-theme') as ThemeMode | null) ?? 'light'
  })

  useEffect(() => {
    window.localStorage.setItem('andy-theme', mode)
    document.documentElement.dataset.theme = mode
    document.documentElement.style.colorScheme = mode
  }, [mode])

  const value = useMemo(
    () => ({
      mode,
      colors: themePalettes[mode],
      toggleTheme: () => setMode((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [mode],
  )

  return createElement(ThemeContext.Provider, { value }, children)
}

export function useTheme() {
  return useContext(ThemeContext)
}
