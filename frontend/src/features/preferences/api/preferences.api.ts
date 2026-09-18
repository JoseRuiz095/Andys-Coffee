import { apiClient } from '../../../app/api'

export interface SystemPreference {
  key: string
  value: string | number | boolean | object
  type: 'string' | 'number' | 'boolean' | 'json'
}

export interface GeneralPreferences {
  businessName: string
  businessHoursOpen: string
  businessHoursClose: string
  currency: string
  currencySymbol: string
  phone?: string
  address?: string
}

const BASE_URL = '/preferences'

export const PreferencesAPI = {
  async getAll() {
    try {
      const { data } = await apiClient.get<{ data: SystemPreference[] }>(BASE_URL)
      return data.data
    } catch (error) {
      return []
    }
  },

  async get(key: string) {
    const { data } = await apiClient.get<{ data: SystemPreference }>(`${BASE_URL}/${key}`)
    return data.data
  },

  async set(key: string, value: string | number | boolean | object) {
    const { data } = await apiClient.patch<{ data: SystemPreference }>(`${BASE_URL}/${key}`, { value })
    return data.data
  },

  async delete(key: string) {
    await apiClient.delete(`${BASE_URL}/${key}`)
  },

  async getGeneralPreferences() {
    const { data } = await apiClient.get<{ data: GeneralPreferences }>(`${BASE_URL}/general`)
    return data.data
  },

  async updateGeneralPreferences(preferences: GeneralPreferences) {
    const { data } = await apiClient.patch<{ data: GeneralPreferences }>(`${BASE_URL}/general`, preferences)
    return data.data
  },
}
