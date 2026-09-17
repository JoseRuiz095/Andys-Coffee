import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'

export type ThemePalette = {
  background: string
  surface: string
  surfaceSecondary: string
  surfaceHover: string
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
  danger: string
  dangerHover: string
  success: string
  successHover: string
  warning: string
  info: string
}

type ThemeContextValue = {
  mode: ThemeMode
  colors: ThemePalette
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
}

export const themePalettes: Record<ThemeMode, ThemePalette> = {
  light: {
    background: '#F7F2E8',
    surface: '#FDFBF7',
    surfaceSecondary: '#D9E3D6',
    surfaceHover: '#F2EFE8',
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
    danger: '#DC2626',
    dangerHover: '#B91C1C',
    success: '#16A34A',
    successHover: '#15803D',
    warning: '#D97706',
    info: '#0284C7',
  },
  dark: {
    background: '#0F1110',
    surface: '#171C1A',
    surfaceSecondary: '#CDA870',
    surfaceHover: '#1F2420',
    panelLeftBg: '#1A1F1D',
    panelRightBg: '#171C1A',
    primary: '#CDA870',
    primaryHover: '#E5C189',
    accent: '#CDA870',
    text: '#E5E7EB',
    textMuted: '#A7B0AA',
    textLight: '#1A1D1A',
    buttonText: '#1A1D1A',
    border: '#2E3936',
    inputBg: '#111715',
    inputText: '#E5E7EB',
    placeholder: '#7B8481',
    ghostText: '#D1D5DB',
    danger: '#EF4444',
    dangerHover: '#F87171',
    success: '#22C55E',
    successHover: '#4ADE80',
    warning: '#F97316',
    info: '#06B6D4',
  },
}

const cssVariableMap = {
  '--color-background': 'background',
  '--color-surface': 'surface',
  '--color-surface-secondary': 'surfaceSecondary',
  '--color-surface-hover': 'surfaceHover',
  '--color-panel-left-bg': 'panelLeftBg',
  '--color-panel-right-bg': 'panelRightBg',
  '--color-primary': 'primary',
  '--color-primary-hover': 'primaryHover',
  '--color-accent': 'accent',
  '--color-text-primary': 'text',
  '--color-text-secondary': 'textMuted',
  '--color-text-light': 'textLight',
  '--color-button-text': 'buttonText',
  '--color-border': 'border',
  '--color-input-bg': 'inputBg',
  '--color-input-text': 'inputText',
  '--color-placeholder': 'placeholder',
  '--color-ghost-text': 'ghostText',
  '--color-danger': 'danger',
  '--color-danger-hover': 'dangerHover',
  '--color-success': 'success',
  '--color-success-hover': 'successHover',
  '--color-warning': 'warning',
  '--color-info': 'info',
} as const

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === 'undefined') {
    return
  }

  const palette = themePalettes[mode]
  const root = document.documentElement

  root.dataset.theme = mode
  root.style.colorScheme = mode

  Object.entries(cssVariableMap).forEach(([cssVar, colorKey]) => {
    root.style.setProperty(cssVar, palette[colorKey as keyof ThemePalette])
  })
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: themePalettes.light,
  setTheme: () => {},
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

    const savedTheme = window.localStorage.getItem('andy-theme')
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    window.localStorage.setItem('andy-theme', mode)
    applyThemeMode(mode)
  }, [mode])

  const value = useMemo(
    () => ({
      mode,
      colors: themePalettes[mode],
      setTheme: (nextMode: ThemeMode) => setMode(nextMode),
      toggleTheme: () => setMode((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [mode],
  )

  return createElement(ThemeContext.Provider, { value }, children)
}

export function useTheme() {
  return useContext(ThemeContext)
}
