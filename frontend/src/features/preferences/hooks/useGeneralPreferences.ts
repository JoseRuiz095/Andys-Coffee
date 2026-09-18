import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PreferencesAPI, type GeneralPreferences } from '../api/preferences.api'

const QUERY_KEY = ['generalPreferences']

export function useGeneralPreferences() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => PreferencesAPI.getGeneralPreferences(),
  })
}

export function useUpdateGeneralPreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (preferences: GeneralPreferences) => PreferencesAPI.updateGeneralPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
