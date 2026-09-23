import { createContext, useContext } from 'react'
import type { GeneralPreferences } from '../../features/preferences/api/preferences.api'

interface GeneralPreferencesContextType {
  preferences: GeneralPreferences | null
  isLoading: boolean
}

// Kept apart from the provider component so React Fast Refresh can hot-reload it.
export const GeneralPreferencesContext = createContext<GeneralPreferencesContextType | undefined>(undefined)

export function useGeneralPreferencesContext() {
  const context = useContext(GeneralPreferencesContext)
  if (context === undefined) {
    throw new Error('useGeneralPreferencesContext must be used within GeneralPreferencesProvider')
  }
  return context
}
