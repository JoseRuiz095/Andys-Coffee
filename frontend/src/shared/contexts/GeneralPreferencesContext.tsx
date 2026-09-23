import { ReactNode, useEffect, useState } from 'react'
import { PreferencesAPI, type GeneralPreferences } from '../../features/preferences/api/preferences.api'
import { GeneralPreferencesContext } from './generalPreferencesStore'

export function GeneralPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<GeneralPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const data = await PreferencesAPI.getGeneralPreferences()
        setPreferences(data)
      } catch (error) {
        console.error('Failed to load general preferences:', error)
        // Set defaults on error
        setPreferences({
          businessName: "Andy's Coffee",
          businessHoursOpen: '09:00',
          businessHoursClose: '22:00',
          currency: 'MXN',
          currencySymbol: '$',
          phone: '',
          address: '',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadPreferences()
  }, [])

  return (
    <GeneralPreferencesContext.Provider value={{ preferences, isLoading }}>
      {children}
    </GeneralPreferencesContext.Provider>
  )
}
